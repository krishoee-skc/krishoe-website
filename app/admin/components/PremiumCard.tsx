import React from "react";

interface PremiumCardProps {
  icon?: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  bgColor?: "primary" | "accent" | "success" | "warning" | "danger";
  onClick?: () => void;
  className?: string;
}

const colorMap = {
  primary: "from-admin-primary/10 to-admin-primary/5 border-admin-primary/20 hover:shadow-md",
  accent: "from-admin-accent/10 to-admin-accent/5 border-admin-accent/20 hover:shadow-md",
  success: "from-emerald-50 to-emerald-25 border-emerald-200 hover:shadow-md",
  warning: "from-amber-50 to-amber-25 border-amber-200 hover:shadow-md",
  danger: "from-red-50 to-red-25 border-red-200 hover:shadow-md",
};

const trendColorMap = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  neutral: "text-gray-600 dark:text-gray-400",
};

export default function PremiumCard({
  icon,
  title,
  value,
  subtitle,
  trend,
  trendValue,
  bgColor = "primary",
  onClick,
  className = "",
}: PremiumCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg border bg-gradient-to-br p-6 transition-all duration-300 ${
        onClick ? "cursor-pointer" : ""
      } ${colorMap[bgColor]} dark:from-gray-800 dark:to-gray-750 dark:border-gray-700 ${className}`}
    >
      {/* Decorative corner */}
      <div className="absolute right-0 top-0 h-12 w-12 opacity-5 rounded-bl-lg bg-gradient-to-l from-current"></div>

      {/* Icon */}
      {icon && <div className="mb-4 inline-block rounded-lg bg-white/50 p-2 dark:bg-gray-700/50">{icon}</div>}

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{title}</h3>

      {/* Value */}
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        {trend && trendValue && (
          <span className={`text-sm font-semibold ${trendColorMap[trend]}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : ""} {trendValue}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{subtitle}</p>}

      {/* Hover effect */}
      {onClick && (
        <div className="absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-br from-white/5 to-transparent"></div>
      )}
    </div>
  );
}
