type LicenseesTabLayoutProps = {
  isOwner: boolean;
  createFormSlot?: React.ReactNode;
  selectorSlot?: React.ReactNode;
  overviewSlot?: React.ReactNode;
  entitlementsSlot?: React.ReactNode;
  registrySlot?: React.ReactNode;
};

export function LicenseesTabLayout({
  isOwner,
  createFormSlot,
  selectorSlot,
  overviewSlot,
  entitlementsSlot,
  registrySlot,
}: LicenseesTabLayoutProps) {
  return (
    <div className="space-y-4">
      {isOwner && createFormSlot}
      {isOwner && selectorSlot}
      {overviewSlot}
      {isOwner && entitlementsSlot}
      {registrySlot}
    </div>
  );
}
