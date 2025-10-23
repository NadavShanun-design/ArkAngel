export const isSupportedFileType = (type: string): boolean => {
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    type.startsWith("text/") ||
    type.includes("document") ||
    type.includes("spreadsheet") ||
    type.includes("presentation")
  );
};



