// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('section');
      const deviceStates = new Map([
        ['compliant', '보안 기준 충족'],
        ['noncompliant', '보안 기준 미충족'],
        ['unknown', '확인 불가'],
      ]);
      const sessionStates = new Map([
        ['active', '활성'],
        ['expired', '만료'],
        ['revoked', '철회됨'],
        ['unknown', '확인 불가'],
      ]);
      const modes = new Map([
        ['connected', '연결 모드'],
        ['demo', '예제 자료'],
        ['disconnected', '연결 없음'],
        ['unknown', '확인 불가'],
      ]);
      const value = (input) => typeof input === 'string' && input.trim()
        ? input : '확인 불가';
      const state = (labels, code) => `${labels.get(code) ?? '확인 불가'}(${typeof code === 'string' && code.trim() ? code : 'unknown'})`;
      const text = (parent, tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        parent.appendChild(node);
        return node;
      };
      const renderSection = (title, input, renderData) => {
        const section = document.createElement('section');
        text(section, 'h4', title);
        text(section, 'p', `자료 모드: ${modes.get(input?.mode) ?? '확인 불가'}`);
        if (input?.status === 'loading') {
          text(section, 'p', '불러오는 중');
        } else if (input?.status === 'error') {
          text(section, 'p', `연결 실패: ${value(input.error?.message)}`);
        } else if (input?.status === 'ok') {
          renderData(section, input.data);
        } else {
          text(section, 'p', '확인 불가');
        }
        root.appendChild(section);
      };

      renderSection('현재 사용자·기기·세션', me, (section, data) => {
        text(section, 'p', `사용자: ${value(data?.user?.label)} (ID: ${value(data?.user?.id)})`);
        text(section, 'p', `기기: ${value(data?.device?.label)} (ID: ${value(data?.device?.id)})`);
        text(section, 'p', `기기 상태: ${state(deviceStates, data?.device?.status)}`);
        text(section, 'p', `세션 ID: ${value(data?.session?.id)}`);
        text(section, 'p', `세션 상태: ${state(sessionStates, data?.session?.status)}`);
      });
      renderSection('기기 목록', devices, (section, data) => {
        if (!Array.isArray(data)) {
          text(section, 'p', '기기 목록 확인 불가');
        } else if (data.length === 0) {
          text(section, 'p', '표시할 기기가 없습니다.');
        } else {
          const list = document.createElement('ul');
          for (const device of data) {
            text(list, 'li', `${value(device?.label)} (ID: ${value(device?.id)}) · ${state(deviceStates, device?.status)}`);
          }
          section.appendChild(list);
        }
      });
      renderSection('세션 목록', sessions, (section, data) => {
        if (!Array.isArray(data)) {
          text(section, 'p', '세션 목록 확인 불가');
        } else if (data.length === 0) {
          text(section, 'p', '표시할 세션이 없습니다.');
        } else {
          const list = document.createElement('ul');
          for (const session of data) {
            text(list, 'li', `세션 ID: ${value(session?.id)} · ${state(sessionStates, session?.status)}`);
          }
          section.appendChild(list);
        }
      });
      return root;
    },
    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('section');
      const text = (tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        root.appendChild(node);
      };
      const value = (input) => typeof input === 'string' && input.trim()
        ? input : '확인 불가';
      const modes = new Map([
        ['connected', '연결 모드'], ['demo', '예제 자료'],
        ['disconnected', '연결 없음'], ['unknown', '확인 불가'],
      ]);
      text('h4', '업무 앱 접근 요청 결과');
      text('p', `자료 모드: ${modes.get(mode) ?? '확인 불가'}`);
      if (appId || status === 'ok') {
        text('p', `대상 앱 ID: ${value(status === 'ok' ? data?.appId ?? appId : appId)}`);
      }
      if (status === 'idle') {
        text('p', '앱을 골라 접속을 요청하세요. 아직 판정을 요청하지 않았습니다.');
      } else if (status === 'loading') {
        text('p', '판정 확인 중입니다. 아직 결과가 도착하지 않았습니다.');
      } else if (status === 'error') {
        text('p', `요청 실패: ${value(error?.message)}`);
        text('p', '요청 실패는 접근 허용이나 접근 거부 판정이 아닙니다. 결과를 확인할 수 없습니다.');
      } else if (status === 'ok') {
        const decisions = new Map([
          ['allow', '접근 허용'], ['deny', '접근 거부'],
          ['challenge', '추가 인증 또는 확인 필요'], ['unknown', '판정 확인 불가'],
        ]);
        const decision = decisions.has(data?.decision) ? data.decision : 'unknown';
        text('p', `판정: ${decisions.get(decision)}(${decision})`);
        text('p', `판정 이유: ${value(data?.reason)}`);
        text('p', `판정 시각: ${value(data?.checkedAt)}`);
        if (decision === 'allow') {
          text('p', '정책상 접근 허용이며 실제 앱 접속 성공을 보장하지 않습니다.');
        } else if (decision === 'challenge') {
          text('p', '추가 인증 또는 확인이 필요합니다. 이 앱이 해당 절차를 대신 수행하지 않습니다.');
        } else if (decision === 'unknown') {
          text('p', '판정을 확인할 수 없어 접근 허용으로 판단할 수 없습니다.');
        }
      } else {
        text('p', '판정 확인 불가(unknown). 요청 상태를 확인할 수 없습니다.');
      }
      return root;
    },
    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('section');
      const text = (parent, tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        parent.appendChild(node);
        return node;
      };
      const value = (input) => typeof input === 'string' && input.trim()
        ? input : '확인 불가';
      const modes = new Map([
        ['connected', '연결 모드'], ['demo', '예제 자료'],
        ['disconnected', '연결 없음'], ['unknown', '확인 불가'],
      ]);
      const kinds = new Map([['access', '접속 기록'], ['xdr', 'XDR 경보']]);
      const stateLabels = {
        access: new Map([['allowed', '접근 허용'], ['denied', '접근 거부'], ['unknown', '확인 불가']]),
        session: new Map([['active', '활성'], ['expired', '만료'], ['revoked', '철회됨'], ['unknown', '확인 불가']]),
        device: new Map([['compliant', '보안 기준 충족'], ['noncompliant', '보안 기준 미충족'], ['unknown', '확인 불가']]),
      };
      const stateText = (type, code) => `${stateLabels[type].get(code) ?? '확인 불가'}(${typeof code === 'string' && code.trim() ? code : 'unknown'})`;
      text(root, 'h4', '본인 접속 기록·저장된 XDR 경보');
      text(root, 'p', `자료 모드: ${modes.get(mode) ?? '확인 불가'}`);
      text(root, 'p', '서버가 전달한 본인의 최근 기록을 표시합니다. 조회 범위는 최대 40건이며, 전체·생략 건수와 확인 시각은 제공 화면에서 확인합니다. XDR 경보는 이미 저장된 기록입니다.');
      if (status === 'loading') {
        text(root, 'p', '기록을 불러오는 중입니다.');
        return root;
      }
      if (status === 'error') {
        text(root, 'p', `기록을 불러오지 못했습니다: ${value(error?.message)}`);
        text(root, 'p', error?.code === 'CONTRACT_MISMATCH'
          ? '확인 불가(CONTRACT_MISMATCH). 응답 형식이 맞지 않아 목록을 확인할 수 없습니다.'
          : '조회 실패로 현재 기록을 확인할 수 없습니다. 기록이 없다는 뜻이 아닙니다.');
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        text(root, 'p', '기록 확인 불가. 현재 기록 목록을 확인할 수 없습니다.');
        return root;
      }
      const events = [...data].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (events.length === 0) {
        text(root, 'p', '표시할 기록이 없습니다.');
        return root;
      }

      const controls = document.createElement('div');
      const filters = {};
      const addFilter = (name, key, values, describe) => {
        const label = text(controls, 'label', name);
        const select = document.createElement('select');
        select.setAttribute('aria-label', name);
        const all = text(select, 'option', '전체');
        all.value = 'all';
        for (const raw of [...new Set(values)].filter(item => typeof item === 'string' && item.trim())) {
          const option = text(select, 'option', describe(raw));
          option.value = raw;
        }
        label.appendChild(select);
        filters[key] = select;
        select.addEventListener('change', () => renderRows());
      };
      addFilter('기록 종류', 'kind', events.map(event => event.kind), raw => `${kinds.get(raw) ?? '확인 불가'}(${raw})`);
      addFilter('업무 앱', 'appId', events.map(event => event.appId), raw => raw);
      addFilter('접속 상태', 'access', events.map(event => event.state?.access), raw => stateText('access', raw));
      root.appendChild(controls);
      const count = text(root, 'p', '');
      count.setAttribute('role', 'status');
      const rows = document.createElement('div');
      const detailHost = document.createElement('div');
      detailHost.setAttribute('aria-live', 'polite');
      root.appendChild(rows);
      root.appendChild(detailHost);

      const showDetail = (event) => {
        const detail = document.createElement('section');
        detail.setAttribute('data-student-event-detail', event.id);
        text(detail, 'h4', `${value(event.id)} 상세`);
        text(detail, 'p', `사건 ID: ${value(event.id)}`);
        text(detail, 'p', `업무 앱 ID: ${value(event.appId)}`);
        const entries = (title, items) => {
          text(detail, 'h5', title);
          if (!Array.isArray(items) || items.length === 0) {
            text(detail, 'p', `${title}: 없음`);
            return;
          }
          const list = document.createElement('ul');
          for (const item of items) text(list, 'li', `ID: ${value(item.id)} · ${value(item.text)}`);
          detail.appendChild(list);
        };
        entries('근거', event.evidence);
        entries('규칙', event.rules);
        text(detail, 'h5', '기록 당시 상태');
        text(detail, 'p', `접속 상태: ${stateText('access', event.state?.access)}`);
        text(detail, 'p', `세션 상태: ${stateText('session', event.state?.session)}`);
        text(detail, 'p', `기기 상태: ${stateText('device', event.state?.device)}`);
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          text(detail, 'h5', '미지원 조치');
          text(detail, 'p', '조치 실행 연결은 준비 중입니다. 아직 지원하지 않는 조치이며 요청을 보내지 않습니다.');
          for (const action of event.supportedActions) {
            const button = text(detail, 'button', `${action} 미지원`);
            button.type = 'button';
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
          }
        }
        detailHost.replaceChildren(detail);
      };
      const renderRows = () => {
        const filtered = events.filter(event =>
          (filters.kind.value === 'all' || event.kind === filters.kind.value)
          && (filters.appId.value === 'all' || event.appId === filters.appId.value)
          && (filters.access.value === 'all' || event.state?.access === filters.access.value));
        count.textContent = `표시 기록: ${filtered.length}건 / 받은 기록: ${events.length}건`;
        rows.replaceChildren();
        detailHost.replaceChildren();
        text(detailHost, 'p', '목록의 상세 버튼을 선택하면 해당 기록을 확인할 수 있습니다.');
        if (filtered.length === 0) {
          text(rows, 'p', '필터 조건에 맞는 기록이 없습니다.');
          return;
        }
        const list = document.createElement('ul');
        for (const event of filtered) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', event.id);
          text(row, 'p', `사건 ID: ${value(event.id)} · 시각: ${value(event.at)}`);
          text(row, 'p', `종류: ${kinds.get(event.kind) ?? '확인 불가'}(${value(event.kind)}) · 업무 앱 ID: ${value(event.appId)}`);
          text(row, 'p', `요약: ${value(event.summary)}`);
          const button = text(row, 'button', `${event.id} 상세`);
          button.type = 'button';
          button.addEventListener('click', () => showDetail(event));
          list.appendChild(row);
        }
        rows.appendChild(list);
      };
      renderRows();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('section');
      const text = (parent, tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        parent.appendChild(node);
        return node;
      };
      const value = (input) => typeof input === 'string' && input.trim()
        ? input : '확인 불가';
      const modes = new Map([
        ['connected', '연결 모드'], ['demo', '예제 자료'],
        ['disconnected', '연결 없음'], ['unknown', '확인 불가'],
      ]);
      const states = {
        device: new Map([['compliant', '보안 기준 충족'], ['noncompliant', '보안 기준 미충족'], ['unknown', '확인 불가']]),
        session: new Map([['active', '활성'], ['expired', '만료'], ['revoked', '철회됨'], ['unknown', '확인 불가']]),
      };
      const stateText = (type, code) => `${states[type].get(code) ?? '확인 불가'}(${typeof code === 'string' && code.trim() ? code : 'unknown'})`;
      const failure = (parent, title, input, retryMessage = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.') => {
        text(parent, 'p', `${title} 조회 실패: ${value(input?.error?.message)}`);
        if (['TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT'].includes(input?.error?.code)) {
          text(parent, 'p', `${title} 조회 시간이 초과됐습니다.`);
        }
        if (input?.error?.code === 'CONTRACT_MISMATCH') {
          text(parent, 'p', '응답 형식 불일치로 확인 불가(CONTRACT_MISMATCH)입니다. 빈 목록으로 판단하지 않습니다.');
        }
        text(parent, 'p', retryMessage);
      };
      text(root, 'h4', '기기·현재 세션·알림과 도움정보');
      text(root, 'p', `자료 모드: ${modes.get(mode) ?? '확인 불가'}`);
      text(root, 'p', '등록 기기는 본인에게 등록되고 회수되지 않은 기기 최대 100개입니다. 세션은 현재 검증된 연결 한 개이며 과거 세션 전체 목록이 아닙니다.');
      const renderCollection = (title, type, input, emptyMessage) => {
        const section = document.createElement('section');
        text(section, 'h5', title);
        text(section, 'p', `자료 모드: ${modes.get(input?.mode ?? mode) ?? '확인 불가'}`);
        if (input?.status === 'loading') {
          text(section, 'p', `${title} 정보를 불러오는 중입니다.`);
        } else if (input?.status === 'error') {
          failure(section, title, input);
        } else if (input?.status === 'ok' && Array.isArray(input.data)) {
          if (input.data.length === 0) text(section, 'p', emptyMessage);
          else {
            const list = document.createElement('ul');
            for (const item of input.data) {
              const identity = type === 'device' ? `기기: ${value(item.label)} (ID: ${value(item.id)})` : `세션 ID: ${value(item.id)}`;
              text(list, 'li', `${identity} · ${stateText(type, item.status)}`);
            }
            section.appendChild(list);
          }
        } else {
          text(section, 'p', `${title} 확인 불가. 목록이 없다는 뜻이 아닙니다.`);
        }
        root.appendChild(section);
      };
      renderCollection('등록 기기', 'device', devices, '등록된 기기가 없습니다.');
      renderCollection('현재 세션', 'session', sessions, '현재 연결된 세션이 없습니다.');

      const notices = document.createElement('section');
      text(notices, 'h5', '주의할 알림');
      if (!Array.isArray(notifications)) text(notices, 'p', '알림 정보를 확인할 수 없습니다.');
      else if (notifications.length === 0) text(notices, 'p', '주의할 알림이 없습니다.');
      else {
        const list = document.createElement('ul');
        for (const item of notifications) {
          text(list, 'li', `자료: ${value(item.resource)} · 코드: ${value(item.code)} · ${value(item.message)}`);
        }
        notices.appendChild(list);
      }
      root.appendChild(notices);

      const help = document.createElement('section');
      text(help, 'h5', '진단 도움정보');
      text(help, 'p', `자료 모드: ${modes.get(diagnostics?.mode ?? mode) ?? '확인 불가'}`);
      let safeDiagnostics = null;
      if (diagnostics?.status === 'idle') {
        text(help, 'p', '아직 도움정보를 불러오지 않았습니다. 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      } else if (diagnostics?.status === 'loading') {
        text(help, 'p', '진단 도움정보를 불러오는 중입니다.');
      } else if (diagnostics?.status === 'error') {
        failure(help, '진단 도움정보', diagnostics, '진단 도움정보는 제공 화면의 도움정보 불러오기 버튼을 직접 눌러 다시 조회하세요. 자동으로 다시 요청하지 않습니다.');
      } else if (diagnostics?.status === 'ok' && diagnostics.data && typeof diagnostics.data === 'object' && !Array.isArray(diagnostics.data)) {
        const data = diagnostics.data;
        safeDiagnostics = {
          requestId: value(data.requestId), component: value(data.component),
          version: value(data.version), checkedAt: value(data.checkedAt),
          engine: { mode: value(data.engine?.mode), code: value(data.engine?.code) },
        };
        for (const key of ['requestId', 'component', 'version', 'checkedAt']) text(help, 'p', `${key}: ${safeDiagnostics[key]}`);
        text(help, 'p', `engine.mode: ${safeDiagnostics.engine.mode}`);
        text(help, 'p', `engine.code: ${safeDiagnostics.engine.code}`);
      } else {
        text(help, 'p', '진단 도움정보를 확인할 수 없습니다.');
      }
      text(help, 'p', '도움 요청에 사용할 위 여섯 값만 복사합니다. 사용자가 버튼을 누를 때만 클립보드에 복사합니다.');
      const copy = text(help, 'button', '도움정보 복사');
      copy.type = 'button';
      copy.disabled = safeDiagnostics === null;
      const copyStatus = text(help, 'p', '');
      copyStatus.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        if (safeDiagnostics === null) return;
        try {
          await navigator.clipboard.writeText(JSON.stringify(safeDiagnostics, null, 2));
          copyStatus.textContent = '도움정보를 클립보드에 복사했습니다.';
        } catch {
          copyStatus.textContent = '도움정보를 복사하지 못했습니다. 브라우저의 복사 권한을 확인한 뒤 직접 다시 누르세요.';
        }
      });
      root.appendChild(help);
      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
      const root = document.createElement('section');
      const text = (tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        root.appendChild(node);
        return node;
      };
      const value = input => typeof input === 'string' && input.trim() ? input : '확인 불가';
      const modes = new Map([
        ['connected', '연결 모드'], ['demo', '예제 자료'],
        ['disconnected', '연결 없음'], ['unknown', '확인 불가'],
      ]);
      const guidance = new Map([
        ['ON_AI_PROVISIONING_PENDING', '계정 연결과 앱 이용 권한을 준비 중이거나 확인하지 못했습니다. 학생 코드 오류로 단정하지 말고 담당자에게 준비 상태를 확인하세요.'],
        ['WB_CLCO_AUTH_REQUIRED', '앱 인증을 확인하지 못했습니다. 계정 연결과 앱 승인을 확인하고 담당자에게 문의하세요.'],
        ['WB_CLCO_ACCESS_BLOCKED', 'AI 접근이 제한됐습니다. 담당자에게 이용 권한과 차단 상태를 확인하세요.'],
        ['WB_CLCO_COHORT_BUDGET_EXHAUSTED', '반의 AI 사용량이 소진됐습니다. 담당자에게 확인하세요.'],
        ['WB_CLCO_LIMIT_REACHED', 'AI 이용 한도에 도달했습니다. 담당자에게 확인하세요.'],
        ['WB_CLCO_SESSION_CLOSED', '현재 AI 이용 시간이 아닙니다. 허용된 이용 시간을 확인하세요.'],
        ['WB_CLCO_RATE_LIMITED', 'AI 요청이 제한됐습니다. 잠시 뒤 직접 다시 점검하세요.'],
        ['WB_CLCO_TIMEOUT', 'AI 응답 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.'],
        ['REQUEST_TIMEOUT', '서버 응답 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.'],
        ['ENGINE_TIMEOUT', '서버 확인 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.'],
        ['TIMEOUT', '응답 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.'],
        ['NETWORK_ERROR', '네트워크 연결을 확인하지 못했습니다. 연결 상태를 확인한 뒤 직접 다시 점검하세요.'],
        ['NETWORK', '네트워크 연결을 확인하지 못했습니다. 연결 상태를 확인한 뒤 직접 다시 점검하세요.'],
        ['WB_CLCO_NETWORK', '네트워크 연결을 확인하지 못했습니다. 연결 상태를 확인한 뒤 직접 다시 점검하세요.'],
        ['WB_CLCO_CANCELLED', 'AI 점검을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.'],
        ['REQUEST_CANCELLED', 'AI 점검을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.'],
        ['CANCELLED', 'AI 점검을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.'],
        ['ON_AI_MODEL_LIST_EMPTY', '현재 앱 권한으로 쓸 수 있는 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.'],
        ['MODEL_NOT_CONFIGURED', '사용할 모델을 확인하지 못했습니다. 담당자에게 모델 설정을 확인하세요.'],
        ['ON_AI_AUTHORIZATION_CHANGED', '점검 중 이용 권한이 바뀌었습니다. 담당자에게 현재 앱 권한을 확인한 뒤 직접 다시 점검하세요.'],
      ]);

      text('h4', 'AI 연결 점검');
      text('p', `자료 모드: ${modes.get(mode) ?? '확인 불가'}`);
      if (status === 'idle' || status === undefined) {
        text('p', 'AI 연결 점검 전');
      } else if (status === 'loading') {
        text('p', 'AI 연결 점검 중');
      } else if (status === 'ok') {
        const labels = new Map([
          ['test', '시험 연결 점검(test)'],
          ['verified', '앱 권한 확인 후 점검(verified)'],
        ]);
        text('p', labels.get(data?.audienceAuthorization) ?? 'AI 연결 점검 결과 확인 불가');
        text('p', `모델 수: ${Number.isSafeInteger(data?.modelCount) && data.modelCount >= 0 ? data.modelCount : '확인 불가'}`);
        text('p', `점검 시각: ${value(checkedAt)}`);
        text('p', '연결만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다.');
      } else if (status === 'error') {
        const code = value(error?.code);
        text('p', `오류 코드: ${code}`);
        text('p', `오류 안내: ${value(error?.message)}`);
        text('p', guidance.get(code) ?? 'AI 연결 결과를 확인하지 못했습니다. 계정 연결과 앱 권한, 네트워크 상태를 확인하세요.');
        text('p', '점검 결과를 확인하지 못했습니다. 이전 결과는 현재 결과가 아닙니다.');
      } else {
        text('p', 'AI 연결 점검 결과 확인 불가');
      }
      // 제공 화면은 explanationAccepted:false를 전달한다. 점검 결과로 사건 설명을 대신하지 않는다.
      if (explanationAccepted !== true) text('p', '사건 설명은 보안 기록에서 별도로 요청하고 확인합니다.');
      text('p', '다시 점검하려면 제공 화면의 AI 연결 점검 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const root = document.createElement('section');
      const text = (tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        root.appendChild(node);
        return node;
      };
      const value = input => typeof input === 'string' && input.trim() ? input : '확인 불가';
      const modes = new Map([
        ['connected', '연결 모드'], ['demo', '예제 자료'],
        ['disconnected', '연결 없음'], ['unknown', '확인 불가'],
      ]);
      text('h4', 'AI 사건 설명');
      text('p', `자료 모드: ${modes.get(explanation?.mode) ?? '확인 불가'}`);
      if (!event || typeof event.id !== 'string' || !event.id.trim()) {
        text('p', '보안 기록에서 설명할 사건을 선택하세요.');
      } else {
        text('p', `사건 ID: ${event.id}`);
        if (explanation?.status === 'ok' && typeof explanation.data?.summary === 'string') {
          root.setAttribute('data-student-explanation-event', event.id);
          text('p', explanation.data.summary);
          text('p', `확인 시각: ${value(checkedAt)}`);
        } else if (explanation?.status === 'error') {
          text('p', `오류 코드: ${value(explanation.error?.code)}`);
          text('p', `오류 안내: ${value(explanation.error?.message)}`);
          text('p', '보안 기록은 그대로입니다. 설명을 확인하지 못한 상태입니다.');
        } else if (explanation?.status === 'loading') {
          text('p', 'AI 사건 설명을 불러오는 중입니다. 보안 기록은 그대로입니다.');
        } else {
          text('p', '선택한 사건의 AI 설명은 아직 실행하지 않았거나 확인할 수 없습니다. 보안 기록은 그대로입니다.');
        }
      }
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
