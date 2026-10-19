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
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
