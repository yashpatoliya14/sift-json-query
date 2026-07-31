import { List, type ListImperativeAPI } from "react-window";
import { TreeDataContext, VirtualRow, type RowData } from "@/components/VirtualRow";

interface Props extends RowData {
  listRef: React.RefObject<ListImperativeAPI | null>;
}

const NO_ROW_PROPS = {} as Record<string, never>;

export function TreePanel({ listRef, ...data }: Props) {
  if (data.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="max-w-xs font-mono text-[13px] text-muted-foreground">
          Nothing loaded yet. Paste JSON, upload a file, or load the sample survey to start sifting.
        </p>
      </div>
    );
  }

  return (
    <TreeDataContext.Provider value={data}>
      <div className="relative h-full">
        {/* strata rail — depth ticks down the gutter */}
        <div className="strata-rail pointer-events-none absolute top-0 bottom-0 left-[3px] w-px opacity-60" />
        <List
          listRef={listRef}
          rowComponent={VirtualRow}
          rowCount={data.rows.length}
          rowHeight={24}
          rowProps={NO_ROW_PROPS}
          overscanCount={8}
          className="h-full"
        />
      </div>
    </TreeDataContext.Provider>
  );
}
