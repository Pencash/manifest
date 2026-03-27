import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  HandHeart,
  MessageSquare,
  History as HistoryIcon,
  LogOut,
  Heart,
  DollarSign,
  TrendingUp,
  Calendar,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUpcomingServices } from "@/hooks/useMobilizationData";

const PRAYER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663236049561/UnYjyJ7WEfrjJobGhetJUW/prayer-moment-BpSzBFsE9EiR37d3KfbKxW.webp";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

const Dashboard = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Prefetch services data for MemberMobilization page
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['upcoming-services'],
      queryFn: fetchUpcomingServices,
    });
  }, [queryClient]);

  const handleRefresh = async () => {
    await refreshProfile();
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Friend";

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="heading-display text-3xl sm:text-4xl text-navy">
                Welcome back, <span className="text-gold">{firstName}</span>
              </h1>
              <p className="text-navy/50 mt-2 text-base font-sans">
                Your dashboard for Manifest Malawi — here is what is happening.
              </p>
            </div>
            <Button variant="ghost" onClick={handleSignOut} className="text-navy/50 hover:text-navy hover:bg-navy/5">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Given", value: "—", icon: DollarSign, trend: "View history", color: "text-gold" },
            { label: "Testimonies", value: "—", icon: MessageSquare, trend: "Share yours", color: "text-sage" },
            { label: "Prayers", value: "—", icon: Heart, trend: "Submit request", color: "text-terracotta" },
            { label: "Events", value: "—", icon: Calendar, trend: "See upcoming", color: "text-navy" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white border-navy/5 hover:border-gold/20 transition-colors duration-300">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <span className="text-xs text-sage font-medium flex items-center gap-1 font-sans">
                    <TrendingUp className="h-3 w-3" />
                    {stat.trend}
                  </span>
                </div>
                <div className="stat-number text-2xl text-navy mb-1">{stat.value}</div>
                <div className="text-navy/40 text-sm font-sans">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <h3 className="heading-display text-xl text-navy mb-4">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: "Record a Giving",
                description: "Submit your tithes and offerings",
                icon: HandHeart,
                buttonLabel: "Give Now",
                gradient: "from-gold/10 to-gold/5",
                iconBg: "bg-gold/15",
                iconColor: "text-gold-dark",
                path: "/give",
              },
              {
                title: "Share a Testimony",
                description: "Share your faith journey with the community",
                icon: MessageSquare,
                buttonLabel: "Share Now",
                gradient: "from-sage/10 to-sage/5",
                iconBg: "bg-sage/15",
                iconColor: "text-sage",
                path: "/testimony",
              },
              {
                title: "Prayer Request",
                description: "Submit your prayer needs",
                icon: Heart,
                buttonLabel: "Request Prayer",
                gradient: "from-terracotta/10 to-terracotta/5",
                iconBg: "bg-terracotta/15",
                iconColor: "text-terracotta",
                path: "/prayer",
              },
            ].map((action) => (
              <Card
                key={action.title}
                className={`group bg-gradient-to-br ${action.gradient} border-navy/5 hover:border-gold/20 hover:shadow-lg hover:shadow-gold/5 transition-all duration-300 cursor-pointer`}
                onClick={() => navigate(action.path)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg ${action.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg text-navy group-hover:text-gold transition-colors font-display">
                        {action.title}
                      </CardTitle>
                      <p className="text-navy/50 text-sm mt-1 font-sans">{action.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-navy text-ivory hover:bg-navy-light">
                    {action.buttonLabel}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Bottom Row: History + Inspiration */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Giving History shortcut */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="lg:col-span-3">
            <Card className="bg-white border-navy/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg text-navy font-display">Giving History</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gold hover:text-gold-dark text-xs font-sans"
                  onClick={() => navigate("/history")}
                >
                  View All <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-navy/40 font-sans">
                  <HistoryIcon className="h-10 w-10 mx-auto mb-3 text-navy/20" />
                  <p className="text-sm">Your giving history will appear here.</p>
                  <Button
                    variant="ghost"
                    className="mt-3 text-gold hover:text-gold-dark"
                    onClick={() => navigate("/history")}
                  >
                    View full history
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Inspirational Card */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="lg:col-span-2">
            <Card className="relative overflow-hidden border-0 h-full">
              <div className="absolute inset-0">
                <img src={PRAYER_IMG} alt="Prayer" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/40" />
              </div>
              <CardContent className="relative z-10 p-6 flex flex-col justify-end h-full min-h-[200px]">
                <p className="text-ivory/90 text-base italic leading-relaxed mb-3 font-display">
                  "For where two or three gather in my name, there am I with them."
                </p>
                <p className="text-gold text-sm font-medium font-sans">Matthew 18:20</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Dashboard;
