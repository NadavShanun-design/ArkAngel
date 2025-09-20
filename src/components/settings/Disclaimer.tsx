import { useVersion } from "@/hooks";

export const Disclaimer = () => {
  const { version, isLoading: isVersionLoading } = useVersion();

  return (
    <div className="flex items-center justify-between py-3 px-4">
      <p className="text-xs text-muted-foreground text-center font-medium">
        💳 Your wallet, your choice! 🤝 All API costs are on you
      </p>
      <div className="flex items-center gap-4">
        <div className="text-xs text-muted-foreground/70 text-center">
          <span className="font-medium">ArkAngel</span>
        </div>
        <div className="text-xs text-muted-foreground/70 text-center">
          {isVersionLoading ? (
            <span>Loading version...</span>
          ) : (
            <span>Version: {version}</span>
          )}
        </div>
      </div>
    </div>
  );
};
