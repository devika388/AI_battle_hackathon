import { useState } from "react";
import { ApiStatus } from "../components/ApiStatus";
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  DataTable,
  DropdownMenu,
  EmptyState,
  FilterChip,
  InputField,
  LoadingSkeleton,
  Modal,
  NavigationBar,
  SearchBar,
  SelectField,
  Sidebar,
  Toast,
  type BadgeTone,
  type TableColumn,
} from "../components/ui";

const palette = [
  { name: "Forest Green", hex: "#365C48", color: "bg-[#365C48]" },
  { name: "Sage Green", hex: "#A8C3A0", color: "bg-[#A8C3A0]" },
  { name: "Cream", hex: "#FAF8F1", color: "bg-[#FAF8F1]" },
  { name: "Blush Pink", hex: "#F2D8D5", color: "bg-[#F2D8D5]" },
  { name: "Butter Yellow", hex: "#F6E8B5", color: "bg-[#F6E8B5]" },
  { name: "Lavender", hex: "#DED9F2", color: "bg-[#DED9F2]" },
  { name: "Powder Blue", hex: "#D9E9F0", color: "bg-[#D9E9F0]" },
  { name: "White", hex: "#FFFFFF", color: "bg-white" },
  { name: "Charcoal", hex: "#242B26", color: "bg-[#242B26]" },
];

const statusTones: { label: string; tone: BadgeTone }[] = [
  { label: "Available", tone: "sage" },
  { label: "Matched", tone: "lavender" },
  { label: "In transit", tone: "powder" },
  { label: "Needs attention", tone: "butter" },
  { label: "Cancelled", tone: "danger" },
];

interface PreviewRow {
  id: number;
  name: string;
  category: string;
  status: string;
}

const previewRows: PreviewRow[] = [
  { id: 1, name: "Seasonal produce", category: "Produce", status: "Available" },
  { id: 2, name: "Freshly baked bread", category: "Bakery", status: "Matched" },
];

const previewColumns: TableColumn<PreviewRow>[] = [
  { header: "Example item", accessor: "name" },
  { header: "Category", accessor: "category" },
  {
    header: "Status",
    accessor: (row) => (
      <Badge tone={row.status === "Available" ? "sage" : "lavender"}>
        {row.status}
      </Badge>
    ),
  },
];

const sidebarItems = [
  { label: "Overview", to: "/#overview" },
  { label: "Components", to: "/#components" },
  { label: "Patterns", to: "/#patterns" },
];

export function DesignSystemPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  return (
    <div className="min-h-screen bg-cream">
      <NavigationBar
        actions={
          <a
            className="inline-flex min-h-10 items-center rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-[#294b39]"
            href="#components"
          >
            Explore the system <span aria-hidden="true" className="ml-2">↘</span>
          </a>
        }
        brand="FoodBridge"
        items={[
          { label: "Design principles", to: "/#overview" },
          { label: "Components", to: "/#components" },
          { label: "Patterns", to: "/#patterns" },
        ]}
      />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <section
          aria-labelledby="page-title"
          className="relative overflow-hidden rounded-[2rem] bg-[#edf1e8] px-6 py-10 sm:px-12 sm:py-14 lg:px-16"
          id="overview"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[36px] border-white/45 sm:right-12 sm:top-8 sm:h-80 sm:w-80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 right-36 h-32 w-32 rounded-full bg-blush/70"
          />
          <div className="relative max-w-3xl animate-rise-in">
            <p className="ds-label text-forest">FoodBridge · Brand foundations</p>
            <h1
              className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-charcoal sm:text-6xl"
              id="page-title"
            >
              A quieter kind of{" "}
              <span className="font-medium italic text-forest">impact.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              A thoughtful, flexible design language for a food system that
              brings people and good things together. Warm by nature. Clear by
              design.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Badge tone="sage">Design system · v1.0</Badge>
              <span className="text-sm text-slate-500">
                Responsive by default · Built for reuse
              </span>
            </div>
          </div>
        </section>

        <div className="mt-12 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Sidebar items={sidebarItems} title="On this page" />
            <div className="mt-5 hidden lg:block">
              <ApiStatus />
            </div>
          </div>

          <div className="min-w-0 space-y-12">
            <section aria-labelledby="color-title">
              <SectionHeading
                eyebrow="01 · The foundation"
                id="color-title"
                title="Color with a lighter footprint"
                description="Nature-led neutrals do the quiet work. Pastel accents bring warmth and help meaningful moments stand out."
              />
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {palette.map((color) => (
                  <Card className="overflow-hidden p-2" key={color.name}>
                    <div
                      aria-label={`${color.name}, ${color.hex}`}
                      className={`h-20 rounded-xl border border-charcoal/5 sm:h-24 ${color.color}`}
                      role="img"
                    />
                    <div className="px-2 pb-2 pt-3">
                      <p className="text-sm font-semibold text-charcoal">
                        {color.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {color.hex}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <section aria-labelledby="type-title">
              <SectionHeading
                eyebrow="02 · Typography"
                id="type-title"
                title="Friendly, clear, considered"
                description="DM Sans balances an approachable voice with crisp, legible interfaces."
              />
              <Card className="mt-5 p-6 sm:p-8">
                <p className="ds-label">Display · 56 / Semibold</p>
                <p className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.04em] text-forest sm:text-5xl">
                  Good food goes further.
                </p>
                <div className="mt-8 grid gap-6 border-t border-charcoal/8 pt-6 sm:grid-cols-2">
                  <div>
                    <p className="ds-label">Body · 16 / Regular</p>
                    <p className="mt-2 text-base leading-7 text-slate-600">
                      Bring surplus food to nearby organizations, simply,
                      thoughtfully, and with care for every step.
                    </p>
                  </div>
                  <div>
                    <p className="ds-label">Label · 12 / Semibold</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-forest">
                      A small detail with a big purpose
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            <section aria-labelledby="components-title" id="components">
              <SectionHeading
                eyebrow="03 · Interface"
                id="components-title"
                title="Small pieces, one shared language"
                description="Components stay consistent across screens, while leaving room for real content and context."
              />

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <Card className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="ds-label">Actions</p>
                      <h3 className="mt-1 text-base font-semibold">Buttons</h3>
                    </div>
                    <span className="text-xs text-slate-400">Primary · 44px</span>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button>Primary action</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="ghost">Quiet action</Button>
                    <Button disabled>Disabled</Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="secondary">
                      Compact
                    </Button>
                    <Button size="lg">Large action</Button>
                  </div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <p className="ds-label">Form controls</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Inputs & selects
                  </h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <InputField
                      hint="Visible to your team"
                      id="sample-name"
                      label="Organization name"
                      placeholder="e.g. Green Table"
                    />
                    <SelectField
                      id="sample-role"
                      label="Your role"
                      options={[
                        { label: "Choose a role", value: "" },
                        { label: "Food donor", value: "donor" },
                        { label: "Community partner", value: "partner" },
                      ]}
                    />
                  </div>
                  <div className="mt-4">
                    <InputField
                      error="Please enter a valid email address."
                      id="sample-email"
                      label="Email · error state"
                      placeholder="you@example.org"
                      type="email"
                    />
                  </div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <p className="ds-label">Discovery</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Search & filters
                  </h3>
                  <div className="mt-5 max-w-md">
                    <SearchBar
                      aria-label="Search example food"
                      id="sample-search"
                      placeholder="Search donations, partners..."
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["All", "Available", "Matched", "Delivered"].map(
                      (filter) => (
                        <FilterChip
                          active={activeFilter === filter}
                          key={filter}
                          onClick={() => setActiveFilter(filter)}
                        >
                          {filter}
                        </FilterChip>
                      ),
                    )}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <DropdownMenu label="More options">
                      <button
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-600 hover:bg-cream"
                        type="button"
                      >
                        Sort by newest
                      </button>
                      <button
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-600 hover:bg-cream"
                        type="button"
                      >
                        Sort by distance
                      </button>
                    </DropdownMenu>
                    <span className="text-xs text-slate-500">
                      Selected: {activeFilter}
                    </span>
                  </div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <p className="ds-label">At-a-glance</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Status badges
                  </h3>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {statusTones.map(({ label, tone }) => (
                      <Badge key={label} tone={tone}>
                        {label}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl bg-cream p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Rescue in progress</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Clear status, calm emphasis
                        </p>
                      </div>
                      <Badge tone="powder">In transit</Badge>
                    </div>
                  </div>
                </Card>

                <Card className="overflow-hidden xl:col-span-2">
                  <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
                    <div>
                      <p className="ds-label">Structured information</p>
                      <h3 className="mt-1 text-base font-semibold">Tables</h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      Example content for component preview only
                    </span>
                  </div>
                  <DataTable columns={previewColumns} rows={previewRows} />
                </Card>
              </div>
            </section>

            <section aria-labelledby="patterns-title" id="patterns">
              <SectionHeading
                eyebrow="04 · Patterns"
                id="patterns-title"
                title="Considered at every screen size"
                description="Navigation, feedback, and empty moments share the same generous spacing and gentle visual rhythm."
              />
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <Card className="p-5 sm:p-6">
                  <p className="ds-label">Navigation</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Responsive sidebar
                  </h3>
                  <p className="mb-4 mt-2 text-sm text-slate-500">
                    Collapses into a touch-friendly menu on smaller screens.
                  </p>
                  <Sidebar
                    items={[
                      { label: "Overview", to: "/" },
                      { label: "Food listings", to: "/listings" },
                      { label: "Community", to: "/community" },
                    ]}
                    title="Your workspace"
                  />
                </Card>

                <Card className="p-5 sm:p-6">
                  <p className="ds-label">Feedback</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Toast notifications
                  </h3>
                  <p className="mb-4 mt-2 text-sm text-slate-500">
                    Brief, accessible confirmations that never interrupt flow.
                  </p>
                  {toastVisible ? (
                    <Toast
                      message="Your preferences have been saved."
                      onDismiss={() => setToastVisible(false)}
                    />
                  ) : (
                    <Button
                      onClick={() => setToastVisible(true)}
                      variant="secondary"
                    >
                      Show success toast
                    </Button>
                  )}
                  <div className="mt-4">
                    <Toast
                      duration={0}
                      message="Here is a helpful note."
                      onDismiss={() => undefined}
                      tone="info"
                    />
                  </div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <p className="ds-label">Progressive disclosure</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Dialogs & confirmations
                  </h3>
                  <p className="mb-5 mt-2 text-sm text-slate-500">
                    Native modal behavior with Escape and backdrop dismissal.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => setModalOpen(true)}>
                      Open modal
                    </Button>
                    <Button
                      onClick={() => setConfirmOpen(true)}
                      variant="secondary"
                    >
                      Confirmation dialog
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 sm:p-6">
                  <p className="ds-label">Loading & empty states</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Make room for what comes next
                  </h3>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div className="space-y-3 rounded-2xl bg-cream p-4">
                      <div className="flex items-center gap-3">
                        <LoadingSkeleton variant="circle" />
                        <div className="flex-1 space-y-2">
                          <LoadingSkeleton className="w-3/4" />
                          <LoadingSkeleton className="w-1/2" />
                        </div>
                      </div>
                      <LoadingSkeleton variant="card" />
                    </div>
                    <EmptyState
                      description="When new food becomes available, it will appear here."
                      title="A little breathing room"
                    />
                  </div>
                </Card>
              </div>
            </section>

            <section aria-labelledby="api-title">
              <SectionHeading
                eyebrow="05 · Live connection"
                id="api-title"
                title="A real signal, not a mock"
                description="The status below checks the running Express health endpoint so the preview remains connected to the existing app foundation."
              />
              <div className="mt-5 max-w-xl">
                <ApiStatus />
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-charcoal/8 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-semibold text-forest">FoodBridge.</span>
          <span>Good food, thoughtfully connected.</span>
        </div>
      </footer>

      <Modal
        actions={
          <Button onClick={() => setModalOpen(false)}>Got it</Button>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="A little more context"
      >
        <p className="text-sm leading-6 text-slate-600">
          Dialogs are reserved for focused decisions and useful details. They
          keep the background in view without adding visual noise.
        </p>
      </Modal>

      <ConfirmationDialog
        confirmLabel="Continue"
        description="This reusable pattern asks for confirmation before an important action."
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setToastVisible(true)}
        open={confirmOpen}
        title="Ready to continue?"
      />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="ds-label text-forest">{eyebrow}</p>
      <h2
        className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-charcoal sm:text-3xl"
        id={id}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
        {description}
      </p>
    </div>
  );
}
