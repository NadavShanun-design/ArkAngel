import { Moon, Sun, Monitor } from "lucide-react";
import { Button, SpotlightArea } from "@/components";
import { useTheme } from "@/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "system":
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeDescription = () => {
    switch (theme) {
      case "light":
        return "Currently in light mode. Click to switch to dark mode.";
      case "dark":
        return "Currently in dark mode. Click to switch to system mode.";
      case "system":
        return "Currently following system preference. Click to switch to light mode.";
      default:
        return "Click to change theme.";
    }
  };

  return (
    <SpotlightArea
      className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50"
    >
      <div className="text-sm">
        <div className="font-medium">Theme</div>
        <div className="text-xs text-muted-foreground capitalize">{theme} mode</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={cycleTheme}
        className="flex items-center gap-2"
        title={getThemeDescription()}
      >
        {getThemeIcon()}
        <span className="sr-only">Toggle theme</span>
      </Button>
    </SpotlightArea>
  );
}