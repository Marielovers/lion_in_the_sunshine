/**
 * XY 방향 반전 설정 — 게임 코드를 고칠 필요 없이 여기의 값만 수정하세요.
 * +1: 현재 방향 / -1: 반대 방향. X와 Y는 서로 독립적으로 바꿀 수 있습니다.
 * 예) touchheadX 움직임이 반대라면 touchheadX: -1 로 바꿉니다.
 * 빠진 항목은 기본값 +1로 처리합니다.
 */
export const DRAG_AXIS_DIRECTION = Object.freeze({
  // 뺨, 머리, 어깨
  touchbolX: 1,          touchbolY: 1,
  touchheadX: 1,         touchheadY: -1,
  touchsholderX: 1,      touchsholderY: -1,
  // 왼손, 오른손, 왼발, 오른발
  touchhandleftX: 1,     touchhandleftY: -1,
  touchhandrightX: 1,    touchhandrightY: -1,
  touchfeetleftX: 1,     touchfeetleftY: -1,
  touchfeetrightX: 1,    touchfeetrightY: -1,
  // 왼허벅지, 오른허벅지, 배
  touchthighleftX: 1,    touchthighleftY: -1,
  touchthighrightX: 1,   touchthighrightY: -1,
  touchbellyX: 1,        touchbellyY: -1,
  // 모델에 지정된 나머지 터치 영역 (Live2D ID 그대로 사용)
  touchbreastX: 1,       touchbreastY: -1,
  touchpussyX: 1,        touchpussyY: -1,
  // 왼팔/오른팔, 왼다리/오른다리: Y 드래그로 구동
  leftarm: 1, rightarm: 1,
  leftleg: -1, rightleg: -1,
});

/** 의상 제거 드래그가 반대로 느껴질 때만 해당 항목을 -1로 변경하세요. */
export const GARMENT_DRAG_DIRECTION = Object.freeze({
  hat: -1,
  coatLeft: 1,
  coatRight: 1,
  ribbon: 1,
  socks: 1,
  shirtLeft: 1,
  shirtRight: 1,
  pants: 1,
});

export const axisDirection = (id) => DRAG_AXIS_DIRECTION[id] === -1 ? -1 : 1;
export const garmentDirection = (zone) => GARMENT_DRAG_DIRECTION[zone] === -1 ? -1 : 1;
