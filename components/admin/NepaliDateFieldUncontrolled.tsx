"use client";

import { useState } from "react";
import NepaliDateField from "@/components/admin/NepaliDateField";

/**
 * A self-managing wrapper around NepaliDateField for server-rendered forms that
 * post with a native `action` and read the date by its `name` — where there is
 * no React state to drive a controlled field. It holds the date in its own state
 * (starting from `defaultValue`, empty for an optional date) and NepaliDateField
 * writes the AD value into a hidden input of that `name`, so the server action
 * receives exactly what the old `<input type="date" name=…>` gave it.
 *
 * Use this inside server components; use NepaliDateField directly wherever the
 * page already owns the value in state.
 */
export default function NepaliDateFieldUncontrolled({
  name,
  defaultValue = "",
  required,
  className,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <NepaliDateField
      name={name}
      value={value}
      onChange={setValue}
      required={required}
      className={className}
    />
  );
}
