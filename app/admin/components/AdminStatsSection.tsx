import React from "react";
import PremiumCard from "./PremiumCard";

interface StatItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  bgColor?: "primary" | "accent" | "success" | "warning" | "danger";
  onClick?: () => void;
}

interface AdminStatsSectionProps {
  title?: string;
  subtitle?: string;
  stats: StatItem[];
  className?: string;
}

export default function AdminStatsSection({
  title,
  subtitle,
  stats,
  className = "",
}: AdminStatsSectionProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>}
          {subtitle && <p className="mt-1 text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <PremiumCard
            key={stat.id}
            icon={stat.icon}
            title={stat.title}
            value={stat.value}
            subtitle={stat.subtitle}
            trend={stat.trend}
            trendValue={stat.trendValue}
            bgColor={stat.bgColor}
            onClick={stat.onClick}
          />
        ))}
      </div>
    </div>
  );
}
