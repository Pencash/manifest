import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { HandHeart, MessageSquare, History as HistoryIcon, LogOut } from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleRefresh = async () => {
    await refreshProfile();
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome, {profile?.full_name || user?.email}
            </h1>
            <p className="text-muted-foreground mt-1">
              Your dashboard for Manifest Malawi
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/give")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <HandHeart className="h-7 w-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">Record a Giving</CardTitle>
                  <CardDescription className="mt-2">Submit your tithes and offerings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Give Now</Button>
            </CardContent>
          </Card>

          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20 hover:border-purple-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/testimony")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-500/20 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  <MessageSquare className="h-7 w-7 text-purple-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-purple-600 transition-colors">Share a Testimony</CardTitle>
                  <CardDescription className="mt-2">Share your faith journey</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button className="w-full bg-purple-600 hover:bg-purple-700">Share Now</Button>
            </CardContent>
          </Card>

          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-rose-500/10 to-red-500/10 hover:from-rose-500/20 hover:to-red-500/20 hover:scale-105 hover:shadow-xl hover:shadow-rose-500/20 hover:border-rose-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/prayer")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-rose-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <MessageSquare className="h-7 w-7 text-rose-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-rose-600 transition-colors">Prayer Request</CardTitle>
                  <CardDescription className="mt-2">Submit your prayer needs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button className="w-full bg-rose-600 hover:bg-rose-700">Request Prayer</Button>
            </CardContent>
          </Card>

          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 hover:scale-105 hover:shadow-xl hover:shadow-green-500/20 hover:border-green-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/history")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-green-500/20 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  <HistoryIcon className="h-7 w-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-green-600 transition-colors">Giving History</CardTitle>
                  <CardDescription className="mt-2">View your contribution records</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button variant="outline" className="w-full border-green-600 text-green-600 hover:bg-green-600 hover:text-white">View History</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Dashboard;
