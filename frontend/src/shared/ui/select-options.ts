import { Children, Fragment, isValidElement, type ReactNode } from "react";

export type SelectOptionItem = {
  value: string;
  label: string;
  disabled: boolean;
};

function flattenLabel(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenLabel).join("");
  if (isValidElement(node)) {
    return flattenLabel((node.props as { children?: ReactNode }).children);
  }
  return "";
}

export function extractSelectOptions(children: ReactNode): SelectOptionItem[] {
  const items: SelectOptionItem[] = [];
  Children.forEach(children, (child) => {
    if (child == null || typeof child === "boolean") return;
    if (Array.isArray(child)) {
      items.push(...extractSelectOptions(child));
      return;
    }
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      items.push(
        ...extractSelectOptions(
          (child.props as { children?: ReactNode }).children,
        ),
      );
      return;
    }
    if (child.type === "option") {
      const props = child.props as {
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      };
      items.push({
        value: props.value == null ? "" : String(props.value),
        label: flattenLabel(props.children),
        disabled: Boolean(props.disabled),
      });
      return;
    }
    if (child.type === "optgroup") {
      items.push(
        ...extractSelectOptions(
          (child.props as { children?: ReactNode }).children,
        ),
      );
    }
  });
  return items;
}
