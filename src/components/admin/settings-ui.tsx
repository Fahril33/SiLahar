import type { ReactNode } from "react";

export function SettingsCard(props: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="settings-card">
      <div className="settings-card-heading">
        <h4>{props.title}</h4>
        {props.description && <p className="settings-hint">{props.description}</p>}
      </div>
      <div className="settings-card-body">{props.children}</div>
      {props.footer && <div className="settings-card-footer">{props.footer}</div>}
    </section>
  );
}

export function SettingsToggle(props: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-toggle-row">
      <span>
        <span className="settings-label">{props.label}</span>
        <span className="settings-hint block">{props.description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
        className="settings-switch"
      />
    </label>
  );
}
