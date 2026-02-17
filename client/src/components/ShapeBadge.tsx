import { cn } from "@/lib/utils";
import { Circle, Square, Triangle, HelpCircle } from "lucide-react";

interface ShapeBadgeProps {
  shape: string;
  className?: string;
  showIcon?: boolean;
}

export function ShapeBadge({ shape, className, showIcon = true }: ShapeBadgeProps) {
  const normalizedShape = shape.toLowerCase();

  let colorClass = "bg-gray-100 text-gray-800 border-gray-200";
  let Icon = HelpCircle;

  if (normalizedShape === "circle") {
    colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    Icon = Circle;
  } else if (normalizedShape === "square") {
    colorClass = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    Icon = Square;
  } else if (normalizedShape === "triangle") {
    colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
    Icon = Triangle;
  } else if (normalizedShape === "other") {
    colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
    Icon = HelpCircle;
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-sm",
      colorClass,
      className
    )}>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {shape}
    </span>
  );
}
