import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { demoMode } from "../config/demo";
import { FoodRescueIllustration } from "../components/FoodRescueIllustration";
import {
  Badge,
  Button,
  Card,
  InputField,
  NavigationBar,
  SelectField,
  type SelectOption,
} from "../components/ui";

type Interest = "donor" | "ngo" | "delivery" | "general" | "other";

const interestOptions: SelectOption[] = [
  { label: "Choose how you'd like to help", value: "general" },
  { label: "Donate surplus food", value: "donor" },
  { label: "Join as an NGO", value: "ngo" },
  { label: "Become a delivery partner", value: "delivery" },
  { label: "Something else", value: "other" },
];

const impactExamples = [
  { value: "1,250 kg", label: "Food rescued", tone: "sage" },
  { value: "3,400", label: "Meals provided", tone: "butter" },
  { value: "186", label: "Successful donations", tone: "blush" },
  { value: "24", label: "Active NGO partners", tone: "powder" },
];

const steps = [
  {
    number: "01",
    title: "Donors list surplus food",
    body: "Share what is available, how much there is, and when it can be collected.",
    color: "bg-sage/35",
  },
  {
    number: "02",
    title: "FoodBridge finds suitable NGOs",
    body: "Nearby community organizations can be matched to the food and timing.",
    color: "bg-lavender",
  },
  {
    number: "03",
    title: "NGOs accept donations",
    body: "An organization confirms it can receive and distribute the donation.",
    color: "bg-blush",
  },
  {
    number: "04",
    title: "Delivery partners collect food",
    body: "A delivery partner helps coordinate a practical pickup and handoff.",
    color: "bg-powder",
  },
  {
    number: "05",
    title: "Food reaches communities",
    body: "Good food is delivered to the people and communities who need it.",
    color: "bg-butter",
  },
];

const roles = [
  {
    id: "donors",
    eyebrow: "For food businesses",
    title: "Donors",
    body: "Give safe surplus food a second chance. Share what you have and connect with nearby organizations ready to receive it.",
    link: "Donate food",
    interest: "donor" as const,
    tone: "bg-[#edf1e8]",
    icon: "↗",
  },
  {
    id: "ngos",
    eyebrow: "For community organizations",
    title: "NGOs",
    body: "Find available food in your area and coordinate donations that fit your community's needs and capacity.",
    link: "Join as an NGO",
    interest: "ngo" as const,
    tone: "bg-[#f3eef8]",
    icon: "♡",
  },
  {
    id: "delivery",
    eyebrow: "For local delivery teams",
    title: "Delivery partners",
    body: "Help close the distance between a willing donor and a community organization through reliable local pickups.",
    link: "Become a partner",
    interest: "delivery" as const,
    tone: "bg-[#eef5f7]",
    icon: "→",
  },
];

const journey = [
  "Listed",
  "Matched",
  "Accepted",
  "Collected",
  "Delivered",
];

export function PublicSitePage() {
  const [interest, setInterest] = useState<Interest>("general");
  const [contactMessage, setContactMessage] = useState("");

  const sendContactRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const contactEmail = import.meta.env.VITE_PUBLIC_CONTACT_EMAIL?.trim();
    if (!contactEmail) {
      setContactMessage(
        "Contact email is not configured yet. Please check back soon.",
      );
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const selectedInterest = String(formData.get("interest") ?? "general");
    const subject = `FoodBridge inquiry: ${selectedInterest}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Interested in: ${selectedInterest}`,
      "",
      message,
    ].join("\n");

    window.location.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setContactMessage(
      "Your email draft is ready. Send it from your email app to complete your message.",
    );
  };

  return (
    <div className="overflow-hidden bg-cream text-charcoal">
      <NavigationBar
        actions={
          <>
            <Link
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-forest hover:bg-forest/5"
              to="/login"
            >
              Login
            </Link>
            {!demoMode ? (
              <Link
                className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-forest hover:bg-forest/5"
                to="/admin/login"
              >
                Admin login
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#294b39] hover:shadow-md"
              to="/register"
            >
              {demoMode ? "Explore Demo" : "Get Started"}
            </Link>
          </>
        }
        brand="FOODBRIDGE"
        items={[
          { label: "Home", to: "#home" },
          { label: "How It Works", to: "#how-it-works" },
          { label: "About Us", to: "#about-us" },
          { label: "Our Impact", to: "#our-impact" },
          { label: "Contact", to: "#contact" },
        ]}
        tagline="DON'T WASTE IT. BRIDGE IT."
      />

      <main>
        <section
          aria-labelledby="hero-heading"
          className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:min-h-[650px] lg:grid-cols-[1.02fr_0.98fr] lg:gap-0 lg:pb-20"
          id="home"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-48 top-20 h-96 w-96 rounded-full bg-sage/15 blur-3xl"
          />
          <div className="relative z-10 max-w-2xl animate-rise-in">
            <Badge className="mb-6" tone="sage">
              A better way to share surplus
            </Badge>
            <h1
              className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-charcoal sm:text-6xl lg:text-[4.5rem]"
              id="hero-heading"
            >
              Good Food Deserves a{" "}
              <span className="font-medium italic text-forest">
                Second Chance.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Connecting surplus food with the people and communities who need
              it most. Together, we can turn food waste into meaningful impact.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#294b39]"
                to="/register?role=donor"
              >
                Donate Food <span aria-hidden="true">↗</span>
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-forest/20 bg-white/80 px-6 text-sm font-semibold text-forest transition hover:-translate-y-0.5 hover:border-forest/40 hover:bg-white"
                to="/register?role=ngo"
              >
                Join as an NGO
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
              <span className="flex -space-x-2" aria-hidden="true">
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-cream bg-blush text-xs">♡</span>
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-cream bg-butter text-xs">✳</span>
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-cream bg-powder text-xs">↗</span>
              </span>
              <span>Good food travels further when we work together.</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[570px] lg:-mr-4 lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute inset-x-8 bottom-5 top-6 rounded-[46%] bg-[#edf1e8]"
            />
            <div className="relative z-10">
              <FoodRescueIllustration />
            </div>
            <div className="absolute bottom-7 left-0 z-10 max-w-[205px] rounded-2xl border border-white/80 bg-white/90 p-4 shadow-soft backdrop-blur sm:bottom-14 sm:left-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-forest">
                A little surplus
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                can make a meaningful difference.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="problem-heading"
          className="bg-[#f2e7e1]"
          id="about-us"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <p className="ds-label text-forest">The gap we can close</p>
              <h2
                className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"
                id="problem-heading"
              >
                Good food and real need can exist side by side.
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <p className="text-base leading-7 text-slate-700">
                Every day, perfectly usable surplus food can go unshared while
                nearby communities face barriers to accessing fresh meals.
              </p>
              <p className="text-base leading-7 text-slate-700">
                The missing piece is often coordination. FoodBridge is built to
                help donors, organizations, and delivery partners find one
                another and make a thoughtful handoff.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="steps-heading"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
          id="how-it-works"
        >
          <SectionIntro
            eyebrow="A simple path to share"
            id="steps-heading"
            title="From surplus to shared."
            description="A clear, coordinated journey helps good food find its way to the people who can use it."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <Card
                className="group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:shadow-soft"
                key={step.number}
              >
                <div className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold text-forest ${step.color}`}>
                  {step.number}
                </div>
                <h3 className="mt-5 text-lg font-semibold leading-snug">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {step.body}
                </p>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-8 hidden text-lg text-sage lg:block"
                  >
                    →
                  </span>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="roles-heading"
          className="bg-white"
          id="who-we-connect"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <SectionIntro
              eyebrow="Many hands, one purpose"
              id="roles-heading"
              title="There’s a place for you at the table."
              description="Food rescue works best when each part of the community can take part in a way that feels natural."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {roles.map((role) => (
                <article
                  className={`flex h-full flex-col rounded-4xl p-6 sm:p-8 ${role.tone}`}
                  id={role.id}
                  key={role.id}
                >
                  <div className="flex items-center justify-between">
                    <span className="ds-label text-forest">{role.eyebrow}</span>
                    <span
                      aria-hidden="true"
                      className="grid h-11 w-11 place-items-center rounded-full bg-white/70 text-xl text-forest"
                    >
                      {role.icon}
                    </span>
                  </div>
                  <h3 className="mt-8 text-2xl font-semibold tracking-tight">
                    {role.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                    {role.body}
                  </p>
                  <Link
                    className="mt-7 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-5 text-sm font-semibold text-forest transition hover:-translate-y-0.5 hover:shadow-card"
                    to={`/register?role=${role.interest}`}
                  >
                    {role.link} <span aria-hidden="true">↗</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="journey-heading"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
          id="journey"
        >
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
            <div>
              <p className="ds-label text-forest">A journey worth following</p>
              <h2
                className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"
                id="journey-heading"
              >
                Every handoff moves good food forward.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                A shared view of the rescue journey helps everyone know what
                comes next, from the first listing to the final delivery.
              </p>
            </div>
            <Card className="p-6 sm:p-9">
              <ol className="relative grid gap-0 sm:grid-cols-5">
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 left-[1.15rem] top-5 w-px bg-sage sm:left-5 sm:right-5 sm:top-5 sm:h-px sm:w-auto"
                />
                {journey.map((status, index) => (
                  <li
                    className="relative flex items-center gap-4 py-3 sm:flex-col sm:items-start sm:gap-4 sm:py-0"
                    key={status}
                  >
                    <span className="z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-4 border-white bg-sage/30 text-xs font-bold text-forest">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-semibold text-charcoal sm:pr-2">
                      {status}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-7 border-t border-charcoal/8 pt-5 text-sm leading-6 text-slate-500">
                A simple example of the journey—not a live donation tracker.
                Actual status updates depend on the connected platform records.
              </p>
            </Card>
          </div>
        </section>

        <section
          aria-labelledby="rescue-heading"
          className="bg-[#e9edf4]"
          id="community-rescue"
        >
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-3xl">
              <Badge tone="lavender">A thoughtful fallback</Badge>
              <h2
                className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"
                id="rescue-heading"
              >
                When the usual route doesn’t fit, community can help.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Community Rescue Mode describes an alternative path for
                eligible food when a regular NGO match is not available. Food
                safety, handling windows, and approved distribution always
                come first.
              </p>
            </div>
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 justify-self-start rounded-full border border-forest/20 bg-white px-6 text-sm font-semibold text-forest transition hover:-translate-y-0.5 hover:shadow-card lg:justify-self-end"
              href="#how-it-works"
            >
              See how it works <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <section
          aria-labelledby="impact-heading"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
          id="our-impact"
        >
          <SectionIntro
            eyebrow="Small actions add up"
            id="impact-heading"
            title="A picture of what’s possible."
            description="These sample values show the kinds of outcomes FoodBridge can report once verified platform records are connected."
          />
          <div className="mt-7 rounded-2xl border border-[#d6c27b] bg-[#fff9e8] px-5 py-4 text-sm leading-6 text-[#66551f]">
            <strong>DEMONSTRATION DATA ONLY.</strong> The figures below are
            illustrative examples, not actual FoodBridge achievements.
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {impactExamples.map((metric) => (
              <Card className="p-5 sm:p-7" key={metric.label}>
                <div
                  aria-hidden="true"
                  className={`mb-7 h-2 w-12 rounded-full ${metric.tone}`}
                />
                <p className="text-3xl font-semibold tracking-[-0.04em] text-forest sm:text-4xl">
                  {metric.value}
                </p>
                <p className="mt-2 text-sm font-medium text-charcoal">
                  {metric.label}
                </p>
                <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Example only
                </p>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Illustrative values are placeholders. They must be replaced with
            verified records before being used as measured impact.
          </p>
        </section>

        <section
          aria-labelledby="stories-heading"
          className="bg-[#edf1e8]"
          id="stories"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="ds-label text-forest">Community voices</p>
              <h2
                className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"
                id="stories-heading"
              >
                The best stories belong to the people doing the work.
              </h2>
            </div>
            <Card className="p-6 sm:p-8">
              <span
                aria-hidden="true"
                className="text-4xl leading-none text-forest"
              >
                “
              </span>
              <p className="mt-2 text-base font-medium leading-7 text-charcoal">
                Verified partner testimonials will be shared here with
                permission. We’re making space for real voices—not invented
                quotes.
              </p>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Stories coming soon
              </p>
            </Card>
          </div>
        </section>

        <section
          aria-labelledby="contact-heading"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
          id="contact"
        >
          <div className="overflow-hidden rounded-[2rem] bg-forest text-white shadow-soft">
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
              <div className="relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
                <div
                  aria-hidden="true"
                  className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full border-[34px] border-white/10"
                />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage">
                    Let’s make good things happen
                  </p>
                  <h2
                    className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"
                    id="contact-heading"
                  >
                    Good food has a place. Help it find its way.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
                    Whether you have food to share, support a community, or
                    help with delivery, we’d love to hear what brings you here.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-forest transition hover:-translate-y-0.5 hover:bg-cream"
                      to="/register?role=donor"
                    >
                      Donate food
                    </Link>
                    <Link
                      className="inline-flex min-h-11 items-center rounded-full border border-white/35 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                      to="/register?role=ngo"
                    >
                      Join the community
                    </Link>
                  </div>
                </div>
              </div>

              <form
                className="bg-white px-6 py-8 text-charcoal sm:px-10 sm:py-10"
                id="contact-form"
                onSubmit={sendContactRequest}
              >
                <p className="ds-label text-forest">Start a conversation</p>
                <h3 className="mt-2 text-xl font-semibold">
                  Tell us a little about yourself.
                </h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <InputField
                    autoComplete="name"
                    id="contact-name"
                    label="Your name"
                    name="name"
                    placeholder="Name"
                    required
                  />
                  <InputField
                    autoComplete="email"
                    id="contact-email"
                    label="Email address"
                    name="email"
                    placeholder="you@example.com"
                    required
                    type="email"
                  />
                  <div className="sm:col-span-2">
                    <SelectField
                      id="contact-interest"
                      label="I’m interested in"
                      name="interest"
                      onChange={(event) => {
                        setInterest(event.target.value as Interest);
                        setContactMessage("");
                      }}
                      options={interestOptions}
                      value={interest}
                    />
                  </div>
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-charcoal">
                      A note for the FoodBridge team
                    </span>
                    <textarea
                      className="ds-field min-h-28 resize-y"
                      name="message"
                      placeholder="What would you like to explore together?"
                      required
                      rows={4}
                    />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Button type="submit">Continue to email</Button>
                  <p
                    aria-live="polite"
                    className="max-w-xs text-xs leading-5 text-slate-500"
                    role={contactMessage.startsWith("Contact email") ? "alert" : "status"}
                  >
                    {contactMessage ||
                      "This opens an email draft; your details are not stored on this website."}
                  </p>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-charcoal/8 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <a
              className="text-xl font-bold tracking-tight text-forest"
              href="#home"
            >
              FOODBRIDGE<span className="text-[#829f7c]">.</span>
            </a>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Don’t waste it. Bridge it.
            </p>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
              Connecting surplus food with people and communities, one
              thoughtful handoff at a time.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              { label: "Home", to: "#home" },
              { label: "How it works", to: "#how-it-works" },
              { label: "About us", to: "#about-us" },
              { label: "Our impact", to: "#our-impact" },
              { label: "Contact", to: "#contact" },
            ].map((item) => (
              <a
                className="text-sm text-slate-600 hover:text-forest"
                href={item.to}
                key={item.to}
              >
                {item.label}
              </a>
            ))}
            <Link className="text-sm text-slate-600 hover:text-forest" to="/login">
              Login
            </Link>
            {!demoMode ? (
              <Link className="text-sm text-slate-600 hover:text-forest" to="/admin/login">
                Admin login
              </Link>
            ) : null}
          </nav>
          <p className="border-t border-charcoal/8 pt-5 text-xs text-slate-400 md:col-span-2">
            FoodBridge · Good food deserves a second chance.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({
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
    <div className="mx-auto max-w-2xl text-center">
      <p className="ds-label text-forest">{eyebrow}</p>
      <h2
        className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-charcoal sm:text-4xl"
        id={id}
      >
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
        {description}
      </p>
    </div>
  );
}
