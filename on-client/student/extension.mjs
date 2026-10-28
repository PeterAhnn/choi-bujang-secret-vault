// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView({ api } = {}) {
  const pcDashboard = createPcDashboard(api);
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
      pcDashboard.setSdpMode(mode);
      root.appendChild(pcDashboard.element);
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
    renderVulnerabilities({ status, mode, data, error } = {}) {
      const root = document.createElement('section');
      const text = (parent, tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        parent.appendChild(node);
        return node;
      };
      const present = input => (typeof input === 'string' && input.trim() !== '')
        || (typeof input === 'number' && Number.isFinite(input));
      const field = (parent, label, input) => {
        if (present(input)) text(parent, 'p', `${label}: ${input}`);
      };
      const modes = new Map([
        ['connected', '연결 모드'], ['demo', '예제 자료'],
        ['disconnected', '연결 없음'], ['unknown', '확인 불가'],
      ]);
      text(root, 'h4', '설치 패키지와 알려진 취약점 조회');
      text(root, 'p', `자료 모드: ${modes.get(mode) ?? '확인 불가'}`);
      if (status === 'idle') {
        text(root, 'p', '조회 전(idle). 아직 설치 패키지를 조회하지 않았습니다.');
        return root;
      }
      if (status === 'loading') {
        text(root, 'p', '조회 중(loading). 이전 표는 현재 조회 결과가 아닙니다.');
        return root;
      }
      if (status === 'error') {
        text(root, 'p', '조회 실패(error). 현재 취약점 조회 결과를 확인할 수 없습니다.');
        field(root, '오류 코드', error?.code);
        field(root, '오류 안내', error?.message);
        text(root, 'p', error?.code === 'CANCELLED' || error?.code === 'REQUEST_CANCELLED'
          ? '조회가 취소됐습니다. 이전 결과는 현재 확인 결과가 아닙니다.'
          : '조회 실패는 취약점이 없다는 뜻이 아닙니다.');
        text(root, 'p', '필요하면 제공 화면의 설치 패키지 조회 버튼을 직접 누르세요. 자동으로 다시 조회하지 않습니다.');
        return root;
      }
      const scanStates = new Map([
        ['complete', '모두 조회'], ['partial', '일부 조회 실패'],
        ['not_checked', '아직 조회 안 함'], ['not_configured', '조회 준비 미완료'],
        ['unverifiable', 'lock 파일 확인 불가'],
      ]);
      if (status !== 'ok' || !scanStates.has(data?.status) || !Array.isArray(data?.packages)) {
        text(root, 'p', '조회 확인 불가. 현재 입력으로 조회 결과를 확인할 수 없습니다. 취약점이 없다는 뜻이 아닙니다.');
        return root;
      }
      text(root, 'p', `전체 조회 상태: ${scanStates.get(data.status)}(${data.status})`);
      if (data.status === 'not_configured') {
        text(root, 'p', '조회 대상 프로젝트 설정이 필요합니다. 대상 경로와 허용 패키지는 운영자가 준비합니다.');
      } else if (data.status === 'not_checked') {
        text(root, 'p', '승인된 공개 조회 대상이 없어 아직 조회하지 않은 상태입니다. 취약점이 없다는 결과가 아닙니다.');
      } else if (data.status === 'unverifiable') {
        text(root, 'p', 'package-lock.json과 설치 메타데이터를 확인할 수 없어 조회 결과를 판단할 수 없습니다.');
      } else if (data.status === 'partial') {
        text(root, 'p', '일부 조회가 실패했습니다. 이미 받은 취약점 ID는 유지하며 전체 조회 결과를 확정하지 않습니다.');
      }
      field(root, '잠금 파일 형식 버전(lockfileVersion)', data.lockfileVersion);
      field(root, '잠금 파일 해시(lockfileHash)', data.lockfileHash);
      field(root, '조회 시각(checkedAt)', data.checkedAt);
      text(root, 'p', 'OSV는 알려진 취약점 데이터베이스입니다. 조회 범위에서 알려진 항목이 없더라도 패키지나 앱 전체가 안전하다는 보장은 아닙니다.');
      if (data.packages.length === 0) {
        text(root, 'p', data.status === 'complete'
          ? '표시할 패키지 조회 결과가 없습니다.'
          : '표시할 패키지 조회 결과가 없습니다. 미조회·확인 불가를 취약점 없음으로 판단하지 않습니다.');
        return root;
      }
      const packageStates = new Map([
        ['known_vulnerabilities', '알려진 항목 있음'], ['none_found', '알려진 항목 없음'],
        ['unverifiable', '조회 확인 불가'],
      ]);
      const list = document.createElement('ul');
      for (const pkg of data.packages) {
        const row = document.createElement('li');
        if (present(pkg?.name)) row.setAttribute('data-student-package-name', String(pkg.name));
        if (present(pkg?.version)) row.setAttribute('data-student-package-version', String(pkg.version));
        field(row, '패키지 이름', pkg?.name);
        field(row, '설치된 정확한 버전', pkg?.version);
        const packageStatus = packageStates.has(pkg?.status) ? pkg.status : 'unverifiable';
        text(row, 'p', `패키지 조회 상태: ${packageStates.get(packageStatus)}(${packageStatus})`);
        field(row, '출처(source)', pkg?.source);
        field(row, '패키지 조회 시각(checkedAt)', pkg?.checkedAt);
        const findings = Array.isArray(pkg?.vulnerabilities) ? pkg.vulnerabilities : [];
        if (packageStatus === 'unverifiable') {
          text(row, 'p', findings.length > 0
            ? '일부 확인·전체 조회 확인 불가. 이미 받은 취약점 ID를 아래에 표시합니다.'
            : '조회 결과를 확인할 수 없습니다. 취약점이 없다는 뜻이 아닙니다.');
        } else if (packageStatus === 'none_found') {
          text(row, 'p', '이 버전의 조회 범위에서 알려진 항목이 없습니다. 안전을 보장하지 않습니다.');
        }
        if (findings.length > 0) {
          const vulnerabilities = document.createElement('ul');
          for (const finding of findings) {
            const item = document.createElement('li');
            field(item, '취약점 ID', finding?.id);
            field(item, '수정 시각(modified)', finding?.modified);
            vulnerabilities.appendChild(item);
          }
          row.appendChild(vulnerabilities);
        }
        list.appendChild(row);
      }
      root.appendChild(list);
      return root;
    },
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
      const fail = message => {
        text('p', `AI 설명 실패: ${message}`);
        if (typeof explanation?.error?.code === 'string') {
          text('p', `오류 코드: ${value(explanation.error.code)}`);
        }
        text('p', '기록은 그대로입니다. AI 설명 실패는 공식 과제 판정 결과가 아닙니다.');
        return root;
      };
      // 실패는 선택한 사건이 없어도 표시한다. 매 호출의 새 DOM에는 이전 성공 표식이 없다.
      if (explanation?.status === 'error') return fail(value(explanation.error?.message));
      if (!event || typeof event.id !== 'string' || !event.id.trim()) {
        text('p', '보안 기록에서 기록을 먼저 고르세요.');
        return root;
      }
      text('p', `사건 ID: ${event.id}`);
      if (explanation?.status === 'loading') {
        text('p', 'AI 설명 요청 중입니다. 기록은 그대로입니다.');
        return root;
      }
      if (explanation?.status !== 'ok') {
        text('p', '선택한 사건의 AI 설명은 아직 실행하지 않았거나 확인할 수 없습니다. 기록은 그대로입니다.');
        return root;
      }

      const data = explanation.data;
      if (data?.executed === true) return fail('AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다.');
      if (typeof data?.summary !== 'string' || !data.summary.trim()
        || !Array.isArray(data.evidenceIds) || !Array.isArray(data.proposals)) {
        return fail('설명 자료를 확인할 수 없어 이 설명을 쓸 수 없습니다.');
      }
      const evidence = Array.isArray(event.evidence) ? event.evidence : [];
      const byId = new Map(evidence.map(item => [item?.id, item]));
      const cited = data.evidenceIds;
      if (!cited.length || !evidence.length) return fail('근거가 부족해 이 설명을 쓸 수 없습니다.');
      if (new Set(cited).size !== cited.length || cited.some(id => typeof id !== 'string'
        || !byId.has(id) || typeof byId.get(id)?.text !== 'string')) {
        return fail('근거 ID가 선택한 사건의 근거와 맞지 않아 이 설명을 쓸 수 없습니다.');
      }
      const supported = Array.isArray(event.supportedActions) ? event.supportedActions : [];
      if (data.proposals.some(proposal => !proposal || !supported.includes(proposal.action)
        || typeof proposal.reason !== 'string' || !Array.isArray(proposal.evidenceIds)
        || !proposal.evidenceIds.length || proposal.evidenceIds.some(id => !byId.has(id)))) {
        return fail('제안의 조치나 근거가 선택한 사건과 맞지 않아 이 설명을 쓸 수 없습니다.');
      }

      root.setAttribute('data-student-explanation-event', event.id);
      text('h5', 'AI 설명(참고용)');
      text('p', data.summary);
      text('p', 'AI 설명은 해석입니다. 사실 판단은 근거·규칙과 연동 시스템의 상태로 합니다.');
      text('h5', '인용한 근거');
      const evidenceList = text('ul', '');
      for (const id of cited) {
        const item = document.createElement('li');
        item.textContent = `${id} — ${byId.get(id).text}`;
        evidenceList.appendChild(item);
      }
      text('h5', '규칙');
      if (Array.isArray(event.rules) && event.rules.length) {
        const ruleList = text('ul', '');
        for (const rule of event.rules) {
          const item = document.createElement('li');
          item.textContent = `${value(rule?.id)} — ${value(rule?.text)}`;
          ruleList.appendChild(item);
        }
      } else {
        text('p', '없음');
      }
      text('h5', '확인 불가 상태');
      const unknownStates = [['access', '접속'], ['session', '세션'], ['device', '기기']]
        .filter(([key]) => event.state?.[key] === 'unknown');
      if (unknownStates.length) {
        for (const [, label] of unknownStates) text('p', `${label}: 확인 불가(unknown)`);
      } else {
        text('p', '없음');
      }
      text('h5', 'AI 조치 제안');
      if (!data.proposals.length) {
        text('p', supported.length
          ? 'AI가 제안한 조치가 없습니다.'
          : '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).');
      } else {
        for (const proposal of data.proposals) {
          text('p', `조치: ${proposal.action}`);
          text('p', `제안 이유: ${proposal.reason}`);
          text('p', `제안 근거 ID: ${proposal.evidenceIds.join(', ')}`);
          text('p', '사람 확인이 필요하며 아직 실행되지 않았습니다.');
        }
      }
      text('p', '설명·제안만으로 보안 조치는 실행되지 않습니다.');
      text('p', `확인 시각: ${value(checkedAt)}`);
      return root;
    },
    renderAction({ status = 'idle', event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } = {}) {
      const root = document.createElement('section');
      const text = (tag, content) => {
        const node = document.createElement(tag);
        node.textContent = content;
        root.appendChild(node);
        return node;
      };
      const present = value => (typeof value === 'string' && value.trim().length > 0)
        || (typeof value === 'number' && Number.isFinite(value));
      const field = (label, value) => {
        if (present(value)) text('p', `${label}: ${value}`);
      };
      const labels = new Map([
        ['idle', '아직 미실행(idle)'],
        ['loading', '조치 준비 또는 결과 조회 중(loading)'],
        ['prepared', '준비됨·미실행(prepared)'],
        ['executing', '서버에 전달 중(executing)'],
        ['pending', '서버 접수·처리 중(pending)'],
        ['succeeded', '효과 확인(succeeded)'],
        ['denied', '거절(denied)'],
        ['failed', '실패(failed)'],
        ['unknown', '결과 불명(unknown)'],
        ['expired', '확인 기한 지남(expired)'],
        ['error', '요청 처리 안 됨(error)'],
      ]);
      let current = labels.has(status) ? status : 'unknown';
      if (current === 'succeeded' && observation?.effectApplied !== true) current = 'unknown';
      text('h4', '보안 조치 요청과 결과');
      text('p', labels.get(current));
      if (current === 'idle') {
        text('p', '아직 조치를 실행하지 않았습니다. AI 제안만으로 조치가 실행되지는 않습니다.');
      } else if (current === 'loading') {
        text('p', '조치를 준비하거나 연동 시스템의 결과를 조회하고 있습니다. 결과는 아직 확인되지 않았습니다.');
      } else if (current === 'prepared') {
        text('p', '준비만 됐으며 아직 실행되지 않았습니다. 제공 화면에서 사건·대상·확인 기한을 읽고 사람이 확인해야 합니다.');
        field('확인 기한', confirmationExpiresAt);
      } else if (current === 'executing') {
        text('p', '요청을 서버에 전달하고 있습니다. 처리 결과와 효과는 아직 확인되지 않았습니다.');
      } else if (current === 'pending') {
        text('p', '서버가 요청을 받아 처리 중입니다. 접수 응답(ACK)은 효과 확인이 아닙니다. 결과는 아직 확인되지 않았습니다.');
      } else if (current === 'succeeded') {
        text('p', 'effectApplied: true');
        text('p', `관측 시각: ${present(observation?.observedAt) ? observation.observedAt : '확인 불가'}`);
      } else if (current === 'unknown') {
        text('p', '효과가 없다고도 성공했다고도 판단할 수 없습니다. 제공 화면의 결과 재조회 버튼으로 연동 시스템 결과만 다시 확인하세요. 실행 요청을 다시 보내는 동작이 아닙니다.');
      } else if (current === 'expired') {
        text('p', '사람 확인 기한이 지났습니다. 제공 화면에서 조치를 다시 준비하고 현재 대상과 기한을 확인하세요.');
      } else if (current === 'denied') {
        text('p', '연동 시스템이 요청을 거절했습니다.');
      } else if (current === 'failed') {
        text('p', '연동 시스템의 조치 처리가 실패했습니다.');
      } else if (current === 'error') {
        text('p', '요청이 처리되지 않았습니다. 안전한 오류 안내를 확인하세요.');
      }
      if (['denied', 'failed', 'unknown', 'expired', 'error'].includes(current)) field('안내', message);
      if (current === 'error') {
        field('오류 코드', error?.code);
        field('오류 안내', error?.message);
      }

      // 식별 속성은 현재 입력의 사건·요청을 가리킨다. 조치의 성공을 뜻하는 속성이 아니다.
      if (present(event?.id)) root.setAttribute('data-student-action-event', String(event.id));
      if (present(receipt?.requestId)) root.setAttribute('data-student-action-request', String(receipt.requestId));
      field('사건 ID', event?.id);
      if (Array.isArray(event?.evidence)) {
        for (const evidence of event.evidence) field('근거 ID', evidence?.id);
      }
      field('조치 ID', actionId);
      field('실제 대상 ID', target?.id);
      field('대상 세대(generation)', target?.generation);
      field('요청 ID(requestId)', receipt?.requestId);
      field('접수 ID(receiptId)', receipt?.receiptId);
      field('응답 버전(version)', receipt?.version);
      if (receipt?.replayed === true) text('p', '기존 요청의 응답 재사용(replayed: true)입니다. 새 조치를 실행했다는 뜻이 아닙니다.');
      if (Array.isArray(event?.supportedActions) && event.supportedActions.length === 0) {
        text('p', '연동 시스템이 지원하는 조치가 없어 조치 준비 버튼이 없는 것이 정상입니다.');
      }
      text('p', '버튼 조작·사람 확인·요청 전송·중복 방지·결과 재조회는 제공 화면이 처리합니다. 이 학생 표시는 별도 요청을 보내거나 자동으로 다시 실행하지 않습니다.');
      text('p', '「조치 화면 취소」는 이미 서버에 전달된 조치 효과를 되돌리지 않습니다.');
      return root;
    },
  };
}

// 마지막 총공세: 제공 PC 수집기를 사용하는 학생 표시·수동 조회 이력입니다.
// PC 요청으로 onChange를 호출하지 않아 기존 기록의 필터·선택을 보존합니다.
function createPcDashboard(api) {
  const element = document.createElement('section');
  element.setAttribute('data-student-pc-dashboard', '');
  element.setAttribute('aria-label', '나라찬 PC 관제 대시보드');
  const node = (parent, tag, value) => {
    const result = document.createElement(tag);
    if (value !== undefined) result.textContent = value;
    parent.appendChild(result);
    return result;
  };
  node(element, 'h3', '나라찬 · PC 관제 대시보드');
  node(element, 'p', '제공 기능: 내 PC 읽기 전용 수집기. 학생 개선: 항목별 설명과 최근 수동 조회 비교. 자동 조회·설정 변경·외부 전송은 하지 않습니다.');
  const sdp = node(element, 'p', 'SDP 연결 상태: 확인 불가(unknown). PC 실측과 별도입니다.');
  const controls = node(element, 'div');
  const reload = node(controls, 'button', 'PC 상태 다시 조회'); reload.type = 'button';
  const cancel = node(controls, 'button', 'PC 조회 취소'); cancel.type = 'button';
  const announcement = node(element, 'p'); announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite');
  const current = node(element, 'section'); current.setAttribute('data-student-pc-current', ''); current.setAttribute('aria-label', '현재 PC 조회 결과');
  const historyHost = node(element, 'section'); historyHost.setAttribute('data-student-pc-history', ''); historyHost.setAttribute('aria-label', '최근 수동 조회');
  let state = 'idle', data = null, errorCode = '', busy = false, generation = 0;
  const history = [];
  const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const unavailable = reason => ({state: 'unavailable', reason: pcReason(reason)});
  const gib = value => `${(value / 1024 ** 3).toFixed(2)} GiB`;
  const time = value => `${new Date(value).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', hour12: false})} (한국 시간) · ${value}`;
  function normalize(raw) {
    if (raw?.schema !== 'aleph.on.pc-status.v1' || raw.source !== 'local-pc' || !raw.metrics || typeof raw.metrics !== 'object' || Array.isArray(raw.metrics)) return null;
    const measured = typeof raw.measuredAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(raw.measuredAt) ? Date.parse(raw.measuredAt) : NaN;
    if (!Number.isFinite(measured) || Date.now() - measured > 300000 || measured - Date.now() > 30000) return null;
    const m = raw.metrics, metrics = {};
    metrics.cpu = m.cpu?.state === 'ok' && nonnegative(m.cpu.usagePercent) && m.cpu.usagePercent <= 100 && m.cpu.sampleMs === 200
      ? {state: 'ok', usagePercent: m.cpu.usagePercent, sampleMs: 200} : unavailable(m.cpu?.reason);
    metrics.memory = m.memory?.state === 'ok' && count(m.memory.usedBytes) && count(m.memory.totalBytes) && m.memory.totalBytes > 0 && m.memory.usedBytes <= m.memory.totalBytes
      ? {state: 'ok', usedBytes: m.memory.usedBytes, totalBytes: m.memory.totalBytes} : unavailable(m.memory?.reason);
    metrics.disk = m.disk?.state === 'ok' && count(m.disk.freeBytes) && count(m.disk.totalBytes) && m.disk.totalBytes > 0 && m.disk.freeBytes <= m.disk.totalBytes
      ? {state: 'ok', freeBytes: m.disk.freeBytes, totalBytes: m.disk.totalBytes} : unavailable(m.disk?.reason);
    metrics.network = m.network?.state === 'ok' && count(m.network.interfaceCount) && count(m.network.ipv4Count)
      ? {state: 'ok', interfaceCount: m.network.interfaceCount, ipv4Count: m.network.ipv4Count} : unavailable(m.network?.reason);
    const profiles = m.firewall?.profiles, names = ['Domain', 'Private', 'Public'];
    metrics.firewall = m.firewall?.state === 'ok' && Array.isArray(profiles) && profiles.length === 3 && names.every(name => profiles.filter(p => p?.name === name && typeof p.enabled === 'boolean').length === 1)
      ? {state: 'ok', profiles: names.map(name => { const p = profiles.find(v => v.name === name); return {name, enabled: p.enabled}; })} : unavailable(m.firewall?.reason);
    const e = m.events, since = typeof e?.since === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(e.since) ? Date.parse(e.since) : NaN;
    metrics.events = e?.state === 'ok' && count(e.warningCount) && count(e.errorCount) && e.warningCount + e.errorCount <= 5000 && e.sampleLimit === 5000 && typeof e.truncated === 'boolean' && Number.isFinite(since) && Math.abs(measured - since - 86400000) <= 300000
      ? {state: 'ok', warningCount: e.warningCount, errorCount: e.errorCount, sampleLimit: 5000, truncated: e.truncated, since: e.since} : unavailable(e?.reason);
    return {source: 'local-pc', measuredAt: raw.measuredAt, metrics};
  }
  function metricCard(parent, title, metric, display, explanation) {
    const card = node(parent, 'article');
    card.style.padding = '12px'; card.style.border = '1px solid var(--border, #334155)'; card.style.borderRadius = '10px';
    node(card, 'h4', title);
    const missingReason = state === 'idle' ? '아직 조회하지 않았습니다.' : state === 'loading' ? '이번 조회가 진행 중입니다.' : state === 'cancelled' ? '화면 조회를 취소해 현재 값을 확인하지 않았습니다.' : '이번 조회의 값을 확인할 수 없습니다.';
    node(card, 'p', metric?.state === 'ok' ? display(metric) : `확인 불가 · ${metric?.reason ?? missingReason}`);
    node(card, 'p', explanation);
  }
  function paintHistory() {
    historyHost.replaceChildren(); node(historyHost, 'h4', '최근 수동 조회');
    node(historyHost, 'p', '이 화면에서 받은 최근 10회까지만 메모리에 보관합니다. 과거 측정값이며 현재 상태나 보안 판정이 아닙니다. 새로고침하면 지워집니다.');
    if (!history.length) { node(historyHost, 'p', '아직 비교할 조회가 없습니다.'); return; }
    const scroll = node(historyHost, 'div'); scroll.style.overflowX = 'auto';
    const table = node(scroll, 'table'); node(table, 'caption', '최근 조회 시각별 자원 비교');
    const head = node(table, 'thead'), header = node(head, 'tr');
    for (const title of ['측정 시각', 'CPU 사용률(%)', '메모리 사용량(GiB)', '앱 디스크 여유(GiB)']) { const th = node(header, 'th', title); th.setAttribute('scope', 'col'); }
    const body = node(table, 'tbody');
    for (const sample of [...history].reverse()) {
      const row = node(body, 'tr'), m = sample.metrics;
      node(row, 'td', time(sample.measuredAt));
      node(row, 'td', m.cpu.state === 'ok' ? m.cpu.usagePercent.toFixed(1) : '확인 불가');
      node(row, 'td', m.memory.state === 'ok' ? (m.memory.usedBytes / 1024 ** 3).toFixed(2) : '확인 불가');
      node(row, 'td', m.disk.state === 'ok' ? (m.disk.freeBytes / 1024 ** 3).toFixed(2) : '확인 불가');
    }
    if (history.length > 1) {
      const previous = history.at(-2).metrics.cpu, latest = history.at(-1).metrics.cpu;
      if (previous.state === 'ok' && latest.state === 'ok') node(historyHost, 'p', `직전 수동 조회 대비 CPU 차이: ${(latest.usagePercent - previous.usagePercent).toFixed(1)}%p. 측정 시점이 다른 약 200ms 구간의 비교입니다.`);
    }
  }
  function paint() {
    element.setAttribute('data-state', state); element.setAttribute('aria-busy', String(state === 'loading'));
    reload.disabled = busy || typeof api?.get !== 'function'; cancel.disabled = state !== 'loading';
    announcement.textContent = typeof api?.get !== 'function' ? '제공 PC 조회 API를 확인할 수 없습니다. 학생 모듈 연결을 확인하거나 제공 화면의 내 PC 확인을 사용하세요.'
      : state === 'idle' ? '아직 PC를 조회하지 않았습니다. 버튼을 직접 누르면 제공 수집기로 읽습니다.'
      : state === 'loading' ? '내 PC를 조회하는 중입니다. 이전 값을 현재 결과로 표시하지 않습니다.'
      : state === 'cancelled' ? `화면의 조회를 취소했습니다. 늦은 결과를 무시합니다. 공유 GET 자체를 취소한 것은 아닙니다.${busy ? ' 원래 요청이 끝난 뒤 다시 조회할 수 있습니다.' : ' 버튼을 눌러 다시 조회할 수 있습니다.'}`
      : state === 'error' ? `PC 조회 실패(${errorCode}). 이전 값을 현재 결과로 표시하지 않습니다. 연결을 확인한 뒤 PC 상태 다시 조회를 직접 누르세요.`
      : 'PC 조회 응답을 받았습니다. 항목별 결과와 측정 시각을 확인하세요. 자동으로 갱신하지 않습니다.';
    current.replaceChildren(); node(current, 'h4', '현재 PC 조회 결과');
    if (data) node(current, 'p', `자료: 실제 조회 · 출처: ${data.source} · 측정 시각: ${time(data.measuredAt)}`);
    else node(current, 'p', '현재 확인된 실측값이 없습니다. 예시 값이나 이전 값을 대신 표시하지 않습니다.');
    const grid = node(current, 'div'); grid.style.display = 'grid'; grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))'; grid.style.gap = '12px';
    const m = data?.metrics ?? {};
    metricCard(grid, 'CPU 사용률', m.cpu, v => `${v.usagePercent.toFixed(1)}%`, '전체 CPU의 약 200ms 측정 구간입니다. 작업 관리자와 집계 시점이 다를 수 있습니다.');
    metricCard(grid, '메모리 사용량', m.memory, v => `${gib(v.usedBytes)} / ${gib(v.totalBytes)}`, '사용량 / 전체 용량입니다. 1 GiB = 1,073,741,824바이트입니다.');
    metricCard(grid, '앱 디스크 여유', m.disk, v => `${gib(v.freeBytes)} / ${gib(v.totalBytes)}`, '이 앱이 위치한 디스크의 여유 / 전체 용량입니다. PC의 모든 디스크 합계가 아닙니다.');
    metricCard(grid, 'Windows 방화벽', m.firewall, v => v.profiles.map(p => `${p.name}: ${p.enabled ? '켜짐' : '꺼짐'}`).join(' · '), 'Domain·Private·Public 세 프로필의 설정만 읽습니다. 앱이 설정을 바꾸지 않으며 보호 전체의 안전 판정이 아닙니다.');
    const details = node(current, 'div'); details.style.display = 'grid'; details.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))'; details.style.gap = '12px';
    metricCard(details, '네트워크 구성', m.network, v => `인터페이스 ${v.interfaceCount}개 · IPv4 구성 ${v.ipv4Count}개`, '주소를 제외한 로컬 구성 수입니다. 인터넷 접속 성공이나 ZTNA 허용을 확인한 결과가 아닙니다.');
    metricCard(details, 'Windows 기록 요약', m.events, v => `최근 24시간 경고 ${v.warningCount}건 · 오류 ${v.errorCount}건`, 'System·Application의 경고·오류 집계입니다. 침해나 공격 탐지 결과가 아닙니다.');
    if (m.events?.state === 'ok') node(current, 'p', `기록 조회 시작: ${time(m.events.since)} · 끝: 위 측정 시각 · 최대 ${m.events.sampleLimit.toLocaleString('ko-KR')}건${m.events.truncated ? ' · 상한 때문에 일부 기록이 생략됐습니다.' : ' · 조회 범위에서 생략 없음.'}`);
    paintHistory();
  }
  async function refresh() {
    if (busy || typeof api?.get !== 'function') return;
    const requestGeneration = ++generation; busy = true; state = 'loading'; data = null; errorCode = ''; paint();
    try {
      const result = await api.get('/api/pc/status');
      if (requestGeneration !== generation) return;
      const normalized = result?.ok === true ? normalize(result.data) : null;
      if (!normalized) {
        state = 'error'; errorCode = result?.ok === true ? 'CONTRACT_MISMATCH' : pcError(result?.error?.code);
      } else {
        state = 'ok'; data = normalized;
        if (history.at(-1)?.measuredAt !== data.measuredAt) { history.push(data); if (history.length > 10) history.shift(); }
      }
    } catch { if (requestGeneration === generation) { state = 'error'; errorCode = 'NETWORK_ERROR'; } }
    finally { busy = false; paint(); }
  }
  reload.addEventListener('click', refresh);
  cancel.addEventListener('click', () => { if (state !== 'loading') return; generation++; state = 'cancelled'; data = null; paint(); });
  paint();
  return {element, setSdpMode(mode) {
    const labels = new Map([['connected', 'SDP 자료는 연결 모드(connected)입니다.'], ['disconnected', 'SDP 미연결(disconnected)입니다.'], ['demo', 'SDP 자료는 예제(demo)이며 실제 연결이 아닙니다.']]);
    sdp.textContent = `${labels.get(mode) ?? 'SDP 연결 상태: 확인 불가(unknown)입니다.'} PC 실측 결과와 별도입니다.`;
  }};
}

function pcReason(reason) {
  return new Map([['permission_denied', '읽기 권한이 없습니다.'], ['timeout', '조회 시간이 초과됐습니다.'], ['query_failed', '조회하지 못했습니다.'], ['unsupported', '이 운영체제에서 제공하지 않습니다.'], ['unsupported_platform', '이 운영체제에서 제공하지 않습니다.'], ['cancelled', '조회가 취소됐습니다.'], ['invalid_sample', '측정 구간을 확인할 수 없습니다.'], ['invalid_response', '응답 형식이 맞지 않습니다.']]).get(reason) ?? '응답 형식이나 값을 확인할 수 없습니다.';
}

function pcError(code) {
  return ['TIMEOUT', 'REQUEST_TIMEOUT', 'NETWORK_ERROR', 'CANCELLED', 'NOT_ALLOWED', 'CONTRACT_MISMATCH'].includes(code) ? code : 'REQUEST_FAILED';
}
