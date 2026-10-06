// Same-origin authentication transport. Never returns the server API key.
export function createAuthHandler({env=process.env,fetchImpl=fetch}={}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const path=req.query?.authPath;
    const grant=req.query?.grant_type;
    const token=path==='token' && req.method==='POST'
      && ['password','refresh_token'].includes(grant);
    const logout=path==='logout' && req.method==='POST';
    const user=path==='user' && req.method==='GET';
    if (!token && !logout && !user) return res.status(404).json({error:'AUTH_ROUTE_NOT_ALLOWED'});
    if (req.method==='POST' && req.headers?.origin!==`https://${req.headers?.host}`)
      return res.status(403).json({error:'AUTH_ORIGIN_REJECTED'});
    let base;
    try {base=new URL(env.SUPABASE_URL);} catch { /* reject below */ }
    const key=env.SUPABASE_SECRET_KEY;
    if (!base || base.protocol!=='https:' || base.pathname!=='/' || base.search || base.hash
      || base.username || base.password || !/^[a-z0-9]+\.supabase\.co$/u.test(base.hostname)
      || typeof key!=='string' || !key.startsWith('sb_secret_'))
      return res.status(503).json({error:'AUTH_NOT_CONFIGURED'});
    let body;
    if (token) {
      const input=req.body;
      if (!input || typeof input!=='object' || Array.isArray(input))
        return res.status(400).json({error:'INVALID_AUTH_INPUT'});
      if (grant==='password') {
        if (typeof input.email!=='string' || !input.email || input.email.length>320
          || typeof input.password!=='string' || !input.password || input.password.length>1024)
          return res.status(400).json({error:'INVALID_AUTH_INPUT'});
        body={email:input.email,password:input.password};
      } else {
        if (typeof input.refresh_token!=='string' || !input.refresh_token || input.refresh_token.length>2048)
          return res.status(400).json({error:'INVALID_AUTH_INPUT'});
        body={refresh_token:input.refresh_token};
      }
    }
    const authorization=req.headers?.authorization;
    if ((user || logout) && (typeof authorization!=='string'
      || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(authorization)
      || authorization.length>16384)) return res.status(401).json({error:'INVALID_LOGIN'});
    try {
      const url=new URL(`/auth/v1/${path}`,base);
      if (token) url.searchParams.set('grant_type',grant);
      if (logout) url.searchParams.set('scope','local');
      const reply=await fetchImpl(url,{method:req.method,
        headers:{apikey:key,'Content-Type':'application/json',
          ...(user || logout ? {Authorization:authorization}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),
        redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
      if (!reply.ok) {
        let code;
        try {code=(await reply.json()).code;} catch { /* use generic error */ }
        const safe=['invalid_credentials','email_not_confirmed','refresh_token_not_found','refresh_token_already_used'].includes(code)?code:'AUTH_FAILED';
        return res.status(reply.status===429?429:401).json({code:safe,message:'Authentication failed'});
      }
      if (logout) return res.status(200).json({});
      const data=await reply.json();
      const id=user?data.id:data.user?.id;
      if (typeof id!=='string' || !/^[a-f0-9-]{36}$/iu.test(id)) throw new Error('INVALID_AUTH_RESPONSE');
      if (user) return res.status(200).json({id});
      if (typeof data.access_token!=='string' || typeof data.refresh_token!=='string'
        || !Number.isFinite(data.expires_in) || data.access_token.length>16384
        || data.refresh_token.length>2048) throw new Error('INVALID_AUTH_RESPONSE');
      // These are the signed-in user's session tokens, never the server API key.
      return res.status(200).json({access_token:data.access_token,refresh_token:data.refresh_token,
        expires_in:data.expires_in,token_type:'bearer',user:{id}});
    } catch {return res.status(502).json({error:'AUTH_UNAVAILABLE'});}
  };
}
export default createAuthHandler();
