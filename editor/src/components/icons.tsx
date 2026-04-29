import type { JSX } from "solid-js";

interface IconProps {
  class?: string;
  size?: number;
}

function Icon(props: IconProps & { children: JSX.Element }) {
  const size = props.size ?? 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      class={props.class}
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M9 1v4h4M5 9h6M5 11.5h4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </Icon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3 4.5 8.5 4.5 8.5S12.5 9 12.5 6A4.5 4.5 0 0 0 8 1.5z" stroke="currentColor" stroke-width="1.25" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" />
    </Icon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 4a1 1 0 0 1 1-1H6l1.5 2H13.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
    </Icon>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13c0-3 2-4 4-5s4-2 4-5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <circle cx="3" cy="13" r="1.5" stroke="currentColor" stroke-width="1.25" />
      <circle cx="11" cy="3" r="1.5" stroke="currentColor" stroke-width="1.25" />
    </Icon>
  );
}

export function LayoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" stroke-width="1.25" />
      <path d="M1.5 5.5h13M6 5.5v9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </Icon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.25" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.06 1.06M11.84 11.84l1.06 1.06M3.1 12.9l1.06-1.06M11.84 4.16l1.06-1.06" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 10V3M5 6l3-3 3 3" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M2 11v1.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.5 2.5l3 3L5 14H2v-3L10.5 2.5z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 4h11M6 4V2.5h4V4M12.5 4l-.7 9a1 1 0 0 1-1 .95H5.2a1 1 0 0 1-1-.95L3.5 4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </Icon>
  );
}

export function GripVerticalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="4" r="1" fill="currentColor" />
      <circle cx="5.5" cy="8" r="1" fill="currentColor" />
      <circle cx="5.5" cy="12" r="1" fill="currentColor" />
      <circle cx="10.5" cy="4" r="1" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1" fill="currentColor" />
      <circle cx="10.5" cy="12" r="1" fill="currentColor" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.5 8C3 5 5 3 8 3s5 2 6.5 5c-1.5 3-3.5 5-6.5 5s-5-2-6.5-5z" stroke="currentColor" stroke-width="1.25" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.25" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 10 10M8 3C4.5 3 2 5.5 1.5 8c.4 1.3 1.1 2.4 2 3.2M10.5 4.5C12.5 5.4 14 6.6 14.5 8c-.8 2.5-3.5 5-6.5 5a6.4 6.4 0 0 1-2.2-.4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.25" />
      <circle cx="5.5" cy="6" r="1" fill="currentColor" />
      <path d="M1.5 10.5l3-3 3 3 2.5-2.5 3 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.25" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </Icon>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.5 14H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1H11l2.5 2.5V13a1 1 0 0 1-1 1z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
      <path d="M5.5 2v3.5h5V2M5.5 14v-4h5v4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </Icon>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </Icon>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="8" cy="4.5" rx="5" ry="2" stroke="currentColor" stroke-width="1.25" />
      <path d="M3 4.5v3c0 1.1 2.24 2 5 2s5-.9 5-2v-3" stroke="currentColor" stroke-width="1.25" />
      <path d="M3 7.5v3c0 1.1 2.24 2 5 2s5-.9 5-2v-3" stroke="currentColor" stroke-width="1.25" />
    </Icon>
  );
}
