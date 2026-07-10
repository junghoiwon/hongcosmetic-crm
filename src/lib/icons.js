/**
 * icons.js
 * ------------------------------------------------------------------
 * 사이드바 메뉴에서 고를 수 있는 아이콘 목록. app_menus.icon_key에
 * 이 목록의 key(문자열)가 저장되고, Sidebar/메뉴 편집 화면에서 이
 * 매핑을 통해 실제 lucide-react 아이콘 컴포넌트로 바꿔 그립니다.
 * ------------------------------------------------------------------
 */
import {
  LayoutGrid,
  Building2,
  FlaskConical,
  FileText,
  PackageOpen,
  History,
  Settings,
  UserCog,
  LayoutTemplate,
  ListOrdered,
  Factory,
  Boxes,
  Truck,
  ClipboardList,
  BarChart3,
  Warehouse,
  Circle,
  MessagesSquare,
  CalendarDays,
  Receipt,
} from "lucide-react";

export const ICON_MAP = {
  LayoutGrid,
  Building2,
  FlaskConical,
  FileText,
  PackageOpen,
  History,
  Settings,
  UserCog,
  LayoutTemplate,
  ListOrdered,
  Factory,
  Boxes,
  Truck,
  ClipboardList,
  BarChart3,
  Warehouse,
  Circle,
  MessagesSquare,
  CalendarDays,
  Receipt,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export function getMenuIcon(iconKey) {
  return ICON_MAP[iconKey] || Circle;
}
