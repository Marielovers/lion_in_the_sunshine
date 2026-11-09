# 형아 뱃살 간지럽히는 게임 — v3.7

## PC에서 실행

Windows의 `start-game.cmd`를 더블클릭하거나, 압축 해제 폴더에서 CMD를 엽니다.

```bat
npm install
npm run dev -- --force
```

브라우저에서 `http://127.0.0.1:5173/`에 접속하세요. npm 설치 중 Cubism Core 6 다운로드를 자동 시도합니다. 정상 설치된 Core가 없으면 공식 서버 로딩으로 대체합니다.

## XY 드래그 방향을 직접 반전하는 방법

**`controls.config.mjs` 파일만 수정하면 됩니다.**

```js
export const DRAG_AXIS_DIRECTION = Object.freeze({
  touchbolX: 1,          touchbolY: 1,
  touchheadX: 1,         touchheadY: 1,
  // ...
});
```

- `1` = 현재 방향
- `-1` = 반대 방향
- 특정 X만 반대라면 **그 X만 `-1`**로 바꾸고, 같은 부위의 Y는 그대로 둡니다.
- 예: 머리를 위아래로 드래그했을 때 반대로 움직인다면 `touchheadY: -1`.
- 팔이나 다리의 방향은 `leftarm`, `rightarm`, `leftleg`, `rightleg` 값을 바꿉니다.
- **의상 제거 방향**이 반대라면 같은 파일의 `GARMENT_DRAG_DIRECTION`에서 `hat`, `ribbon`, `coatLeft` 등의 값을 `-1`로 변경합니다.

저장한 다음 Vite 개발 서버에서 브라우저를 새로고침하면 변경됩니다. 새로고침만으로 반영되지 않으면 `Ctrl + F5`를 누르세요.

### 모델 자체의 위치와 크기

`game.js`에서 다음 항목을 수정하거나 `http://127.0.0.1:5173/?debug=1`을 여세요.

```js
const screenPlacement={x:0.50,y:-0.05,scale:0.6};
```

`x`가 클수록 오른쪽, `y`가 작을수록 위쪽, `scale`이 클수록 확대됩니다.

## 모바일에서 플레이하기

게임은 세로형 침대 배경(797×1254)에 맞게 자동 조정됩니다. 모바일에서 캐릭터를 크게 터치할 수 있도록 게임 영역을 넓혔고, sleep 게이지는 세로 화면에서는 배경 오른쪽 위에 겹쳐 보입니다. 버튼은 터치 가능한 크기이며 손·주먹 버튼은 왼쪽 아래에 있습니다.

휴대폰으로 직접 접속할 때는 PC와 휴대폰을 **같은 Wi-Fi**에 연결한 후 PC의 CMD에서 다음을 실행하세요.

```bat
npm install
npm run dev:mobile
ipconfig
```

`ipconfig` 명령은 **다른 CMD 창**에서 실행하고, 표시된 PC의 IPv4 주소를 확인합니다. 휴대폰 브라우저에서 `http://PC의-IPv4-주소:5173/`에 접속합니다. Windows 방화벽이 물어보면 신뢰하는 개인 네트워크에서만 허용하세요. `dev:mobile`은 로컬 네트워크에 개발 서버를 개방하므로 공개 Wi-Fi에서는 실행하지 않는 것이 좋습니다.

## 이번 변경 사항

- 새 침대 이미지(`assets/bed.png`)를 원본 797×1254 비율로 표시, Live2D를 앞에 유지
- 모바일 세로·가로 방향에 따라 보드와 sleep 게이지 배치 자동 변경
- XY 파라미터별 방향 반전 설정 파일(`controls.config.mjs`) 추가
- 모델의 실제 최소/최대값에 비례하는 드래그 수치 유지, 모바일에서는 화면 크기에 맞게 드래그 필요 거리 조정
- 안내 문구, 중복 제목, 버전 표시, 화면 토스트를 제거해 게임 UI 간소화
- 시작 타이틀, 시작 버튼, 손/주먹, sleep, 음소거, 게임오버/재시작만 표시
- 기존 `규칙(5).xlsx` 및 sleep 자동 회복(마우스나 손가락을 뗀 즉시 초당 8) 유지

## 참고

새 모델 텍스처가 별도로 제공되지 않아 v3.4의 텍스처를 유지했습니다. 이 환경에서는 Windows/모바일에서의 실제 WebGL2 렌더링과 브라우저 터치 입력까지 확인하지 못했습니다.

## v3.7: 손 터치 전용 happy / Zzz 표시

- **손 모드**에서 머리(`touchhead`), 어깨(`touchsholder`), 양손(`touchhand`), 양발(`touchfeet`), 양쪽 허벅지(`touchthigh`), 배(`touchbelly`)를 터치할 때에만 `happy`가 증가합니다.
- 해당 HitArea에 유효하게 접촉하면 첫 터치에 1회, 드래그 중 유효한 이동 판정이 발생할 때에도 증가합니다. 기존의 `DRAG_INTERVAL=95`ms를 유지합니다.
- **주먹, 뺨, 의상 해제/단추, 팔·다리 이동, angry 터치, 수면 자동 회복, 5521 버튼**은 happy를 올리지 않습니다.
- 배·허벅지는 wake 증가 규칙이 있어도 happy를 올립니다. 기존 wake/sleep 변화 규칙은 변경하지 않았습니다.
- 화면 상단의 `happy` 표시를 하트에서 **`Zzz 0/100`**으로 변경했습니다. 터치 시 나타나는 pink/black 하트 효과는 기존대로입니다.
- `happy=100`이면 **리온은 꿀잠을 잤습니다** 엔딩이며, 5521 버튼은 이전처럼 sleep을 100으로 고정합니다.
- `game-logic.mjs`의 `HAPPY_PER_ACTION`은 공통 배율, `HAPPY_BY_TOUCH_ZONE`은 부위별 증가량 설정입니다. 예: `head:0.5`, `belly:2`.

## 실행

```bat
npm install
npm run dev -- --force
```
