/**
 * useElementSize.js
 * ------------------------------------------------------------------
 * ResizeObserver 기반으로 요소의 실제 렌더링 크기(px)를 추적하는 훅.
 * 대시보드 카드들이 화면편집기에서 크기가 바뀔 때 내부 레이아웃을
 * 스스로 다시 계산할 수 있도록 합니다.
 * ------------------------------------------------------------------
 */
import { useEffect, useRef, useState } from "react";

export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

/**
 * 카드 너비/높이를 기준으로 4단계(소/중/대/전체) 중 하나로 분류합니다.
 * 기존 크기 프리셋 기준: 소=270×110, 중(리스트류)=570×320, 대=1160×360.
 * 너비가 좁아도 높이가 충분히 크면(예: 570×320) "대" 단계로 취급해서
 * 비교/상세 목록까지 보여줄 공간이 있는지를 함께 판단합니다.
 */
export function getCardTier(width, height) {
  if (width === 0 && height === 0) return "medium";
  if (width < 320 || height < 150) return "small";
  if (width >= 900) return "full";
  if (width >= 480 || height >= 260) return "large";
  return "medium";
}
