import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  HandHeart,
  MessageSquare,
  History as HistoryIcon,
  LogOut,
  Heart,
  DollarSign,
  Calendar,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchUpcomingServices } from "@/hooks/useMobilizationData";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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

  // Prefetch services data
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['upcoming-services'],
      queryFn: fetchUpcomingServices,
    });
  }, [queryClient]);

  // Fetch total giving amount
  const { data: givingTotal } = useQuery({
    queryKey: ['my-giving-total', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase
        .from('givings')
        .select('amount')
        .eq('profile_id', user.id)
        .eq('status', 'verified');
      if (error) throw error;
      return data?.reduce((sum, g) => sum + Number(g.amount), 0) ?? 0;
    },
    enabled: !!user?.id,
  });

  // Fetch testimony count
  const { data: testimonyCount } = useQuery({
    queryKey: ['my-testimony-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('testimonies')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', user.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Fetch prayer count
  const { data: prayerCount } = useQuery({
    queryKey: ['my-prayer-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('prayer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', user.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Fetch upcoming events count
  const { data: upcomingEventsCount } = useQuery({
    queryKey: ['upcoming-events-count'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .gte('service_date', today)
        .eq('is_published', true)
        .eq('approval_status', 'approved');
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Fetch recent givings for history snapshot
  const { data: recentGivings } = useQuery({
    queryKey: ['my-recent-givings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('givings')
        .select('id, amount, currency, payment_method, status, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const handleRefresh = async () => {
    await Promise.all([
      refreshProfile(),
      queryClient.invalidateQueries({ queryKey: ['my-giving-total'] }),
      queryClient.invalidateQueries({ queryKey: ['my-testimony-count'] }),
      queryClient.invalidateQueries({ queryKey: ['my-prayer-count'] }),
      queryClient.invalidateQueries({ queryKey: ['upcoming-events-count'] }),
      queryClient.invalidateQueries({ queryKey: ['my-recent-givings'] }),
    ]);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Friend";

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `MK${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `MK${(amount / 1000).toFixed(1)}K`;
    return `MK${amount.toLocaleString()}`;
  };

  const stats = [
    {
      label: "Total Given",
      value: givingTotal != null ? formatCurrency(givingTotal) : "—",
      icon: DollarSign,
      color: "text-accent",
      path: "/history",
    },
    {
      label: "Testimonies",
      value: testimonyCount != null ? String(testimonyCount) : "—",
      icon: MessageSquare,
      color: "text-secondary-foreground",
      path: "/testimony",
    },
    {
      label: "Prayers",
      value: prayerCount != null ? String(prayerCount) : "—",
      icon: Heart,
      color: "text-destructive",
      path: "/prayer",
    },
    {
      label: "Upcoming Events",
      value: upcomingEventsCount != null ? String(upcomingEventsCount) : "—",
      icon: Calendar,
      color: "text-foreground",
      path: "/events/upcoming",
    },
  ];

  const quickActions = [
    {
      title: "Record a Giving",
      description: "Submit your tithes and offerings",
      icon: HandHeart,
      buttonLabel: "Give Now",
      iconColor: "text-accent",
      path: "/give",
    },
    {
      title: "Share a Testimony",
      description: "Share your faith journey with the community",
      icon: MessageSquare,
      buttonLabel: "Share Now",
      iconColor: "text-secondary-foreground",
      path: "/testimony",
    },
    {
      title: "Prayer Request",
      description: "Submit your prayer needs",
      icon: Heart,
      buttonLabel: "Request Prayer",
      iconColor: "text-destructive",
      path: "/prayer",
    },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <h1 className="heading-display text-2xl sm:text-3xl md:text-4xl text-foreground">
                Welcome back, <span className="text-accent">{firstName}</span>
              </h1>
              <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base font-sans">
                Your dashboard for Manifest Malawi
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground self-start">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Quick Stats — clickable */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Carousel opts={{ align: "start", loop: true }} className="lg:hidden" aria-label="Dashboard quick stats">
            <CarouselContent className="-ml-3 py-2 pr-4">
              {stats.map((stat) => (
                <CarouselItem key={stat.label} className="basis-[82%] sm:basis-[48%] pl-3">
                  <Card className="bg-card border-none card-elevated cursor-pointer group h-full" onClick={() => navigate(stat.path)}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl icon-container-glass flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                          <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-70" />
                      </div>
                      <div className="stat-number text-xl sm:text-3xl text-foreground mb-0.5 sm:mb-1 truncate">{stat.value}</div>
                      <div className="w-8 h-0.5 rounded-full bg-accent/40 mb-1" />
                      <div className="text-muted-foreground text-xs sm:text-sm font-sans">{stat.label}</div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <div className="hidden lg:grid lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-card border-none card-elevated cursor-pointer group" onClick={() => navigate(stat.path)}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl icon-container-glass flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="stat-number text-xl sm:text-3xl text-foreground mb-0.5 sm:mb-1 truncate">{stat.value}</div>
                  <div className="w-8 h-0.5 rounded-full bg-accent/40 mb-1" />
                  <div className="text-muted-foreground text-xs sm:text-sm font-sans">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <h3 className="heading-display text-xl text-foreground mb-4">Quick Actions</h3>
          <Carousel opts={{ align: "start", loop: true }} className="lg:hidden" aria-label="Quick actions">
            <CarouselContent className="-ml-3 py-2 pr-4">
              {quickActions.map((action) => (
                <CarouselItem key={action.title} className="basis-[86%] sm:basis-[48%] pl-3">
                  <Card className="group bg-card border-none card-elevated cursor-pointer h-full" onClick={() => navigate(action.path)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl icon-container-glass bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg text-foreground group-hover:text-accent transition-colors font-display">
                            {action.title}
                          </CardTitle>
                          <p className="text-muted-foreground text-sm mt-1 font-sans">{action.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        {action.buttonLabel}
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-1 top-1/2 h-9 w-9 border-border/70 bg-background/90 shadow-md" />
            <CarouselNext className="right-1 top-1/2 h-9 w-9 border-border/70 bg-background/90 shadow-md" />
          </Carousel>
          <div className="hidden lg:grid lg:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="group bg-card border-none card-elevated cursor-pointer"
                onClick={() => navigate(action.path)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl icon-container-glass bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg text-foreground group-hover:text-accent transition-colors font-display">
                        {action.title}
                      </CardTitle>
                      <p className="text-muted-foreground text-sm mt-1 font-sans">{action.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
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
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg text-foreground font-display">Giving History</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-accent hover:text-accent/80 text-xs font-sans"
                  onClick={() => navigate("/history")}
                >
                  View All <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent>
                {recentGivings && recentGivings.length > 0 ? (
                  <div className="space-y-3">
                    {recentGivings.map((giving) => (
                      <div key={giving.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{formatCurrency(Number(giving.amount))}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(giving.created_at), 'MMM d, yyyy')}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          giving.status === 'verified' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                          giving.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {giving.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground font-sans">
                    <HistoryIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">Your giving history will appear here.</p>
                    <Button
                      variant="ghost"
                      className="mt-3 text-accent hover:text-accent/80"
                      onClick={() => navigate("/history")}
                    >
                      View full history
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Inspirational Card */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="lg:col-span-2">
            <Card className="relative overflow-hidden border-0 h-full">
              <div className="absolute inset-0">
                <img src={PRAYER_IMG} alt="Prayer" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/40" />
              </div>
              <CardContent className="relative z-10 p-6 flex flex-col justify-end h-full min-h-[200px]">
                <p className="text-white/90 text-base italic leading-relaxed mb-3 font-display">
                  "For where two or three gather in my name, there am I with them."
                </p>
                <p className="text-accent text-sm font-medium font-sans">Matthew 18:20</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Dashboard;
