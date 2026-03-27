import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  HandHeart,
  Heart,
  MessageSquare,
  Shield,
  UserPlus,
  LogIn,
  ChevronRight,
  Users,
  BarChart3,
  Calendar,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663236049561/UnYjyJ7WEfrjJobGhetJUW/hero-worship-n8WMPnpaDVUctDoHBLdnkj.webp";
const COMMUNITY_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663236049561/UnYjyJ7WEfrjJobGhetJUW/community-gathering-WrP6tfVEdTbV6U2VMABzLd.webp";
const GIVING_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663236049561/UnYjyJ7WEfrjJobGhetJUW/giving-hands-XwMhKaAHATaWnXAoF7PYq6.webp";
const PATTERN_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663236049561/UnYjyJ7WEfrjJobGhetJUW/abstract-pattern-eNLCfkBviqx7ntgT665iDD.webp";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const Landing = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ivory">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ivory/80 backdrop-blur-lg border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm bg-navy flex items-center justify-center">
                <span className="text-gold font-bold text-sm font-display">M</span>
              </div>
              <span className="text-navy font-semibold text-lg tracking-tight font-display">
                Manifest Malawi
              </span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                className="text-navy/70 hover:text-navy hover:bg-navy/5"
                onClick={() => navigate("/member/auth?mode=login")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Member Login
              </Button>
              <Button
                variant="ghost"
                className="text-navy/70 hover:text-navy hover:bg-navy/5"
                onClick={() => navigate("/admin/auth")}
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Portal
              </Button>
              <Button
                className="bg-navy text-ivory hover:bg-navy-light ml-2"
                onClick={() => navigate("/member/auth?mode=signup")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Join Now
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                className="p-2 text-navy"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-ivory border-t border-gold/20 px-4 pb-4"
          >
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="ghost"
                className="justify-start text-navy/70"
                onClick={() => { navigate("/member/auth?mode=login"); setMobileMenuOpen(false); }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Member Login
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-navy/70"
                onClick={() => { navigate("/admin/auth"); setMobileMenuOpen(false); }}
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Portal
              </Button>
              <Button
                className="bg-navy text-ivory hover:bg-navy-light"
                onClick={() => { navigate("/member/auth?mode=signup"); setMobileMenuOpen(false); }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Join Now
              </Button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="Worship gathering" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/80 to-navy/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-2xl">
            <motion.div variants={fadeUp} custom={0} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/20 border border-gold/30 text-gold text-sm font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                Phaneroo Ministries International
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="heading-display text-5xl sm:text-6xl lg:text-7xl text-ivory mb-6">
              Manifest <span className="text-gold">Malawi</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-ivory/80 text-lg sm:text-xl leading-relaxed mb-10 max-w-lg font-sans">
              Join a vibrant community of believers. Record your giving, share testimonies,
              submit prayer requests, and serve together in the mission of God.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gold text-navy hover:bg-gold-light font-semibold text-base px-8 h-13 shadow-lg shadow-gold/20"
                onClick={() => navigate("/member/auth?mode=signup")}
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Create Member Account
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-ivory/30 text-ivory hover:bg-ivory/10 hover:text-ivory font-medium text-base px-8 h-13"
                onClick={() => navigate("/member/auth?mode=login")}
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="flex gap-8 mt-14 pt-8 border-t border-ivory/15">
              {[
                { label: "Active Members", value: "500+" },
                { label: "Services Held", value: "120+" },
                { label: "Communities", value: "15+" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="stat-number text-2xl sm:text-3xl text-gold">{stat.value}</div>
                  <div className="text-ivory/60 text-sm mt-1 font-sans">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Gold Divider ─── */}
      <div className="gold-divider" />

      {/* ─── Features Section ─── */}
      <section className="py-24 lg:py-32 bg-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-20"
          >
            <motion.span variants={fadeUp} custom={0} className="text-gold font-medium tracking-widest uppercase text-sm font-sans">
              What We Offer
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="heading-display text-4xl sm:text-5xl text-navy mt-4 mb-6">
              Everything You Need to <span className="text-gold italic">Serve & Grow</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-navy/60 text-lg max-w-2xl mx-auto font-sans">
              A comprehensive platform designed for the Manifest Malawi community,
              making it easy to participate in the life and mission of the church.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: HandHeart, title: "Record Giving", description: "Submit tithes, offerings, and pledges with a simple, guided process. Track every contribution.", color: "text-gold", bg: "bg-gold/10" },
              { icon: Heart, title: "Prayer Requests", description: "Share your prayer needs with the community. Stand together in faith and intercession.", color: "text-terracotta", bg: "bg-terracotta/10" },
              { icon: MessageSquare, title: "Share Testimonies", description: "Celebrate what God is doing in your life. Inspire others with your faith journey.", color: "text-sage", bg: "bg-sage/10" },
              { icon: Users, title: "Mobilization", description: "Get involved in service opportunities. Sign up for events and volunteer teams.", color: "text-navy", bg: "bg-navy/10" },
              { icon: BarChart3, title: "Giving History", description: "View your complete contribution records. Download reports for your personal records.", color: "text-gold-dark", bg: "bg-gold/10" },
              { icon: Calendar, title: "Events & Services", description: "Stay updated on upcoming services, special events, and community gatherings.", color: "text-sage", bg: "bg-sage/10" },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="group relative bg-white rounded-lg p-8 border border-navy/5 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 transition-all duration-500"
              >
                <div className={`w-12 h-12 rounded-lg ${feature.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="heading-display text-xl text-navy mb-3">{feature.title}</h3>
                <p className="text-navy/60 leading-relaxed font-sans">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Gold Divider ─── */}
      <div className="gold-divider" />

      {/* ─── Two Audience Section ─── */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.span variants={fadeUp} custom={0} className="text-gold font-medium tracking-widest uppercase text-sm font-sans">
              Get Started
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="heading-display text-4xl sm:text-5xl text-navy mt-4">
              Choose Your <span className="text-gold italic">Path</span>
            </motion.h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Member Card */}
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
              className="group relative overflow-hidden rounded-xl"
            >
              <div className="absolute inset-0">
                <img src={COMMUNITY_IMG} alt="Community" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/30" />
              </div>
              <div className="relative z-10 p-8 sm:p-10 lg:p-12 min-h-[420px] flex flex-col justify-end">
                <div className="w-14 h-14 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center mb-6">
                  <Heart className="h-7 w-7 text-gold" />
                </div>
                <h3 className="heading-display text-3xl text-ivory mb-3">For Members</h3>
                <p className="text-ivory/70 text-lg mb-6 max-w-md font-sans">
                  Access your personal dashboard to record giving, share testimonies, submit prayer requests, and track your journey.
                </p>
                <ul className="space-y-2 mb-8 font-sans">
                  {["Record tithes, offerings & pledges", "Share testimonies & prayer requests", "View giving history & reports", "Join mobilization events"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-ivory/80 text-sm">
                      <ChevronRight className="h-4 w-4 text-gold flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="bg-gold text-navy hover:bg-gold-light font-semibold w-full sm:w-auto"
                  onClick={() => navigate("/member/auth?mode=signup")}
                >
                  Create Member Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {/* Admin Card */}
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={1}
              className="group relative overflow-hidden rounded-xl"
            >
              <div className="absolute inset-0">
                <img src={PATTERN_IMG} alt="Pattern" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/90 to-navy/60" />
              </div>
              <div className="relative z-10 p-8 sm:p-10 lg:p-12 min-h-[420px] flex flex-col justify-end">
                <div className="w-14 h-14 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center mb-6">
                  <Shield className="h-7 w-7 text-gold" />
                </div>
                <h3 className="heading-display text-3xl text-ivory mb-3">For Admin & Finance</h3>
                <p className="text-ivory/70 text-lg mb-6 max-w-md font-sans">
                  Powerful administrative tools to manage payments, expenses, events, attendance, and generate comprehensive reports.
                </p>
                <ul className="space-y-2 mb-8 font-sans">
                  {["Verify payments & manage givings", "Track expenses & approvals", "Generate financial reports", "Manage users & events"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-ivory/80 text-sm">
                      <ChevronRight className="h-4 w-4 text-gold flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold font-semibold w-full sm:w-auto"
                  onClick={() => navigate("/admin/auth")}
                >
                  Admin Login
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Gold Divider ─── */}
      <div className="gold-divider" />

      {/* ─── CTA Section ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={GIVING_IMG} alt="Giving hands" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-navy/90" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} custom={0} className="heading-display text-4xl sm:text-5xl text-ivory mb-6">
              Ready to Join the <span className="text-gold italic">Mission</span>?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-ivory/70 text-lg sm:text-xl mb-10 max-w-2xl mx-auto font-sans">
              Become part of the Manifest Malawi community. Together, we are transforming
              nations with the Word of God.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gold text-navy hover:bg-gold-light font-semibold text-base px-10 h-13 shadow-lg shadow-gold/20"
                onClick={() => navigate("/member/auth?mode=signup")}
              >
                Create Member Account
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-ivory/30 text-ivory hover:bg-ivory/10 hover:text-ivory font-medium text-base px-10 h-13"
                onClick={() => navigate("/admin/auth")}
              >
                Admin Access
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-navy py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-gold/20 flex items-center justify-center">
                <span className="text-gold font-bold text-sm font-display">M</span>
              </div>
              <span className="text-ivory/80 font-medium font-display">Manifest Malawi</span>
            </div>
            <p className="text-ivory/40 text-sm font-sans">
              Phaneroo Ministries International &mdash; Transforming nations with the Word of God.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
