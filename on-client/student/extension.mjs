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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
