import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HandHeart, Heart, MessageSquare, Shield, UserPlus, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-16 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent leading-tight">
            Manifest Malawi
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 text-balance">
            A secure and transparent way to give, share testimonies, and connect with your church
          </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button
                  size="lg"
                  onClick={() => navigate("/member/auth?mode=signup")}
                  className="w-full sm:min-w-[12.5rem]"
                >
                  <UserPlus className="mr-2 h-5 w-5" />
                  Create Member Account
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate("/member/auth?mode=login")}
                  className="w-full sm:min-w-[12.5rem]"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Member Login
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/admin/auth")}
                  className="w-full sm:min-w-[12.5rem]"
                >
                  <Shield className="mr-2 h-5 w-5" />
                  Admin/Finance
                </Button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-secondary" />
                </div>
              <CardTitle className="text-2xl">For Members</CardTitle>
              </div>
              <CardDescription className="text-base sm:text-lg">Access your personal giving dashboard to:</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <HandHeart className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Record tithes, offerings, and pledges</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Share testimonies and faith journey</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Submit prayer requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Track your giving history</span>
                </li>
              </ul>
              <Button size="lg" onClick={() => navigate("/member/auth")} className="w-full mt-6">
                Get Started
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">For Admin & Finance</CardTitle>
              </div>
              <CardDescription className="text-base sm:text-lg">Access administrative tools to:</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Review and approve receipts</span>
                </li>
                <li className="flex items-start gap-2">
                  <HandHeart className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>View all giving records and analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Generate monthly consolidated reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Monitor member attendance overview</span>
                </li>
              </ul>
              <Button size="lg" variant="outline" onClick={() => navigate("/admin/auth")} className="w-full mt-6">
                Admin Login
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <HandHeart className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Easy Giving</CardTitle>
              <CardDescription>Record tithes, offerings, and pledges with just a few clicks</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-secondary/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>Your data is protected with enterprise-grade security</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-accent/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Transparent</CardTitle>
              <CardDescription>Track your contributions and view detailed reports</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-muted-foreground mb-6">
                Join thousands of members using our platform to support Phaneroo's mission
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" onClick={() => navigate("/member/auth?mode=signup")}> 
                  Create Member Account
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/admin/auth")}>
                  Admin Access
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Landing;
