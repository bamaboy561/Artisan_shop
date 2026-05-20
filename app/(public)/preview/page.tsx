import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Scissors,
  Grid3X3,
  Truck,
  Shield,
  Factory,
  Timer,
  Sparkles,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { companyContacts } from "@/lib/site-config";
import "./preview.css";

export const metadata: Metadata = {
  title: "Design Preview",
  robots: "noindex, nofollow",
};

const categories = [
  { icon: Layers, title: "LDSP", desc: "200+ decors, 16/18mm, certified E1", href: "/catalog/ldsp" },
  { icon: Grid3X3, title: "MDF", desc: "Painted facades, milling, 6-25mm", href: "/catalog/mdf" },
  { icon: Sparkles, title: "HPL", desc: "Countertops, commercial wear surfaces", href: "/catalog/hpl" },
  { icon: Factory, title: "Hardware", desc: "Hettich, NUOMI, Samet fittings", href: "/brands" },
];

const services = [
  {
    icon: Scissors,
    title: "Precision Cutting",
    desc: "CNC cutting with 0.1mm accuracy. Standard and custom dimensions with waste optimization.",
    features: ["0.1mm accuracy", "Any complexity", "Waste optimization", "Batch & single orders"],
  },
  {
    icon: Grid3X3,
    title: "Edgebanding",
    desc: "Automatic PVC, ABS, and veneer edgebanding with perfect adhesion and clean finish.",
    features: ["PVC/ABS 0.4-2mm", "Veneer & acrylic", "Decor matching", "QC on every batch"],
  },
];

const advantages = [
  { icon: Factory, title: "In-house Processing", desc: "Own CNC and edgebanding equipment" },
  { icon: Truck, title: "Fast Delivery", desc: "Dispatch in 1-3 days across the region" },
  { icon: Shield, title: "Certified Quality", desc: "E1 and E0.5 emission standards" },
  { icon: Timer, title: "7+ Years", desc: "500+ completed projects" },
];

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-[var(--hero)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(199,106,67,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 grid-veil opacity-20" />
        <div className="relative mx-auto max-w-4xl px-4 pb-24 pt-28 text-center sm:px-6 sm:pt-36 lg:pt-44">
          <div className="glass-panel mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
              Fully stocked - 200+ decors
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Materials that build
            </span>
            <br />
            <span className="bg-gradient-to-r from-[var(--accent)] to-amber-300 bg-clip-text text-transparent">
              your reputation
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 sm:text-xl">
            LDSP, MDF, HPL panels and hardware. Cutting and edgebanding -
            everything for professional furniture production in Bishkek.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/catalog"
              className="group inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_32px_rgba(199,106,67,0.3)] transition-all hover:bg-[var(--accent-strong)] hover:shadow-[0_12px_40px_rgba(199,106,67,0.45)] hover:scale-[1.02]"
            >
              Open Catalog
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/calculator"
              className="glass-panel inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/12 hover:scale-[1.02]"
            >
              Calculate Cutting
            </Link>
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="bg-[var(--background)] px-4 py-16 sm:px-8 lg:px-10 sm:py-20">
        <Container>
          <div className="mb-10 text-center">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Assortment
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
              Everything for production
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--muted)]">
              From raw panels to finished hardware - in one place
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat, i) => (
              <Link
                key={cat.title}
                href={cat.href}
                className={`glass-card gradient-border group rounded-2xl p-6 stagger-${i + 1} reveal-up`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/8 text-[var(--accent)] transition-all group-hover:bg-[var(--accent)] group-hover:text-white group-hover:shadow-[0_0_24px_rgba(199,106,67,0.25)]">
                  <cat.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
                  {cat.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{cat.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] transition-colors group-hover:text-[var(--foreground)]">
                  Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== SERVICES ===== */}
      <section className="border-y border-[var(--line)] bg-[var(--surface)] px-4 py-16 sm:px-8 lg:px-10 sm:py-20">
        <Container>
          <div className="mb-10 text-center">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Services
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
              Processing with precision
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {services.map((svc, i) => (
              <div key={svc.title} className={`glass-card hover-lift rounded-2xl p-6 sm:p-8 stagger-${i + 1} reveal-up`}>
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                    <svc.icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">{svc.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{svc.desc}</p>
                    <ul className="mt-4 grid grid-cols-2 gap-2">
                      {svc.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-[var(--foreground)]/70">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== ADVANTAGES ===== */}
      <section className="bg-[var(--background)] px-4 py-16 sm:px-8 lg:px-10 sm:py-20">
        <Container>
          <div className="mb-10 text-center">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Why Artisan
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
              Built for professionals
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((item, i) => (
              <div key={item.title} className={`glass-card accent-glow rounded-2xl p-6 text-center stagger-${i + 1} reveal-up`}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[var(--surface)] px-4 py-16 sm:px-8 lg:px-10 sm:py-20">
        <Container>
          <div className="glass-panel-strong gradient-border mx-auto max-w-2xl rounded-3xl p-10 text-center sm:p-14">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]/10">
              <MessageCircle className="h-8 w-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Ready to start?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Send your specifications - we will prepare a detailed quote
              within 24 hours covering material, cutting, and edgebanding costs.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/calculator"
                className="group inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_32px_rgba(199,106,67,0.3)] transition-all hover:bg-[var(--accent-strong)] hover:shadow-[0_12px_40px_rgba(199,106,67,0.45)] hover:scale-[1.02]"
              >
                Get Quote
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href={companyContacts.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#25D366]/30 px-6 py-3.5 text-base font-semibold text-[#25D366] transition-all hover:bg-[#25D366]/8"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* ===== BADGE ===== */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="pulse-dot flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
            Design Preview
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--line-strong)] uppercase">/</span>
          <Link href="/" className="font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)]/60 uppercase hover:text-[var(--foreground)] transition-colors">
            Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}
