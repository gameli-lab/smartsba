import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Modern School Assessment
            <span className="text-blue-600 block">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Streamline your school&apos;s assessment process with our
            comprehensive School-Based Assessment system. Track student
            progress, manage grades, and generate insightful reports
            effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
              </Button>
            </Link>
            <Link href="#about">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              About SmartSBA
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              SmartSBA is a comprehensive School-Based Assessment system
              designed to modernize how educational institutions manage student
              assessments, track academic progress, and maintain educational
              standards.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">
                  Multi-School Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage multiple schools from a single platform with role-based
                  access control for administrators, teachers, students, and
                  parents.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">
                  Automated Calculations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Intelligent aggregate calculation system that automatically
                  computes student rankings based on core subjects and best
                  elective performances.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">
                  Real-time Reporting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate comprehensive reports and analytics to track student
                  progress, class performance, and institutional metrics in
                  real-time.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Key Features
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need for modern school assessment
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Grade Management
              </h3>
              <p className="text-gray-600 text-sm">
                Comprehensive grade tracking with CA and exam scores
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Multi-User Support
              </h3>
              <p className="text-gray-600 text-sm">
                Role-based access for all stakeholders
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Student Rankings
              </h3>
              <p className="text-gray-600 text-sm">
                Automated ranking based on performance
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Mobile Friendly
              </h3>
              <p className="text-gray-600 text-sm">
                Access from any device, anywhere
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Announcements Section */}
      <section
        id="announcements"
        className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Latest Announcements
            </h2>
            <p className="text-lg text-gray-600">
              Stay updated with the latest news and updates
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Update v2.1</CardTitle>
                <CardDescription>September 20, 2025</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  New features include automated aggregate calculations and
                  improved performance analytics for better student tracking.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">New School Onboarding</CardTitle>
                <CardDescription>September 18, 2025</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Simplified onboarding process for new schools with
                  step-by-step setup guides and dedicated support.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Training Workshop</CardTitle>
                <CardDescription>September 15, 2025</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Free training sessions for teachers and administrators on
                  effective use of the SmartSBA platform.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section id="events" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Upcoming Events
            </h2>
            <p className="text-lg text-gray-600">
              Don&apos;t miss these important dates
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="bg-blue-100 rounded-lg p-4 mr-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">25</div>
                    <div className="text-sm text-blue-600">SEP</div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    End of Term Assessment Deadline
                  </h3>
                  <p className="text-gray-600 mb-2">
                    Final date for submitting end-of-term scores and assessments
                  </p>
                  <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                    Deadline
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="bg-green-100 rounded-lg p-4 mr-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">30</div>
                    <div className="text-sm text-green-600">SEP</div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Report Card Generation
                  </h3>
                  <p className="text-gray-600 mb-2">
                    Automated report card generation and distribution
                  </p>
                  <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    Automated
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="bg-purple-100 rounded-lg p-4 mr-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">05</div>
                    <div className="text-sm text-purple-600">OCT</div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    New Academic Term Setup
                  </h3>
                  <p className="text-gray-600 mb-2">
                    System preparation for the upcoming academic term
                  </p>
                  <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                    Setup
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">SmartSBA</h3>
              <p className="text-gray-400">
                Modern school assessment system for the digital age.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Grade Management</li>
                <li>Student Rankings</li>
                <li>Report Generation</li>
                <li>Multi-School Support</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Documentation</li>
                <li>Training</li>
                <li>Help Center</li>
                <li>Contact Us</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <div className="text-gray-400">
                <p>Email: btorfu@gmail.com</p>
                <p>Phone: +233 (054) 181 3988</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 SmartSBA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
