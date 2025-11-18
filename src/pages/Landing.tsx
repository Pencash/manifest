import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HandHeart, Heart, MessageSquare, Shield } from "lucide-react";
const Landing = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Manifest Giving Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            A secure and transparent way to give, share testimonies, and connect with your church
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <HandHeart className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Easy Giving</CardTitle>
              <CardDescription>
                Record tithes, offerings, and pledges with just a few clicks
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-secondary/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Your data is protected with enterprise-grade security
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-accent/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Share Testimonies</CardTitle>
              <CardDescription>
                Share your faith journey and encourage others
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Prayer Support</CardTitle>
              <CardDescription>
                Submit prayer requests to our pastoral team
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to start giving?</h2>
              <p className="text-muted-foreground mb-6">
                Join thousands of members using our platform to support Phaneroo's mission
              </p>
              <Button size="lg" onClick={() => navigate("/auth")}>
                Create Your Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Landing;