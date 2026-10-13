import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAuthHandler} from '../api/auth.js';
import {createClient} from '@supabase/supabase-js';

async function call(handler,query,body,headers={host:'library.vercel.app',origin:'https://library.vercel.app'}) {
  const out={};
  await handler({method:'POST',query,body,headers},{setHeader(){},status(s){out.status=s;return this;},json(d){out.body=d;}});
  return out;
}
const env={SUPABASE_URL:'https://syntheticproject.supabase.co',SUPABASE_SECRET_KEY:['sb','secret','fixture'].join('_')};
test('auth transport rejects unknown routes, foreign origins and missing server config before forwarding',async()=>{
  const h=createAuthHandler({env,fetchImpl(){assert.fail('must not forward');}});
  assert.equal((await call(h,{authPath:'admin'},{})).status,404);
  assert.equal((await call(h,{authPath:'token',grant_type:'password'},{},{host:'library.vercel.app',origin:'https://foreign.invalid'})).status,403);
  assert.equal((await call(h,{authPath:'token',grant_type:'password'},{})).status,400);
  const missing=createAuthHandler({env:{},fetchImpl(){assert.fail('must not forward');}});
  assert.equal((await call(missing,{authPath:'token',grant_type:'password'},{})).status,503);
});
test('auth transport forwards only login fields and returns only the user session, never provider/key details',async()=>{
  const h=createAuthHandler({env,fetchImpl:async(url,options)=>{
    assert.equal(url.pathname,'/auth/v1/token');
    assert.equal(url.searchParams.get('grant_type'),'password');
    assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(),['email','password']);
    assert.equal(options.headers.apikey,env.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Authorization,undefined);
    return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,
      user:{id:'11111111-1111-4111-8111-111111111111'},provider_detail:env.SUPABASE_SECRET_KEY});
  }});
  const r=await call(h,{authPath:'token',grant_type:'password'},{email:'synthetic',password:'synthetic',role:'admin'});
  assert.equal(r.status,200);
  assert.equal(JSON.stringify(r.body).includes(env.SUPABASE_SECRET_KEY),false);
  const fail=createAuthHandler({env,fetchImpl:async()=>Response.json({code:'invalid_credentials',message:env.SUPABASE_SECRET_KEY},{status:400})});
  const denied=await call(fail,{authPath:'token',grant_type:'password'},{email:'synthetic',password:'synthetic'});
  assert.equal(denied.status,401);
  assert.equal(JSON.stringify(denied.body).includes(env.SUPABASE_SECRET_KEY),false);
});

test('the installed browser SDK receives safe credential errors through the Auth API version boundary',async()=>{
  for (const code of ['invalid_credentials','email_not_confirmed']) {
    const handler=createAuthHandler({env,fetchImpl:async(_url,options)=>{
      // Supabase uses error_code for legacy requests and code for the declared version.
      const modern=options.headers['X-Supabase-Api-Version']==='2024-01-01';
      return Response.json(modern?{code}:{error_code:code},{status:400});
    }});
    const client=createClient('https://library.vercel.app','auth-proxy',{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:async(input,options)=>{
        const url=new URL(input);
        const headers={};
        let result;
        const response={setHeader(name,value){headers[name]=value;},
          status(status){this.statusCode=status;return this;},
          json(body){result=Response.json(body,{status:this.statusCode,headers});}};
        await handler({method:options.method,query:{authPath:'token',grant_type:url.searchParams.get('grant_type')},
          headers:{host:url.host,origin:url.origin},body:JSON.parse(options.body)},response);
        return result;
      }},
    });
    const {data,error}=await client.auth.signInWithPassword({email:'synthetic@example.invalid',password:'synthetic'});
    assert.equal(data.session,null);
    assert.equal(error.status,401);
    assert.equal(error.code,code);
    assert.equal(JSON.stringify(error).includes(env.SUPABASE_SECRET_KEY),false);
  }
});
