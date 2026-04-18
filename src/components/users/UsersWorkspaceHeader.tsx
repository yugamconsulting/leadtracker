type UsersTabKey = "licensees" | "tenant-users" | "platform-controls";

type UsersWorkspaceHeaderProps = {
  usersTab: UsersTabKey;
  isOwner: boolean;
  usersContextTenantName: string | null;
  usersContextTenantStatus: string | null;
  onUsersTabChange: (tab: UsersTabKey) => void;
};

export function UsersWorkspaceHeader({
  usersTab,
  isOwner,
  usersContextTenantName,
  usersContextTenantStatus,
  onUsersTabChange,
}: UsersWorkspaceHeaderProps) {
  return (
    <>
      <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-100">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUsersTabChange("licensees")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${usersTab === "licensees" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Client Accounts
          </button>
          <button
            type="button"
            onClick={() => onUsersTabChange("tenant-users")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${usersTab === "tenant-users" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Team & Settings
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => onUsersTabChange("platform-controls")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${usersTab === "platform-controls" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}
            >
              System Settings
            </button>
          )}
        </div>
      </div>

      {(usersTab === "licensees" || usersTab === "tenant-users") && usersContextTenantName && (
        <div className="sticky top-2 z-20 rounded-2xl border border-[#d6daac] bg-[#f7f8eb]/95 px-4 py-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#788023]">Current Client</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{usersContextTenantName}</span>
            {usersContextTenantStatus && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{usersContextTenantStatus}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
