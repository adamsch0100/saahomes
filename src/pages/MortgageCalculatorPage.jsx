import React from "react";
import SEO from "../components/SEO";

export default function MortgageCalculatorPage() {
  return (
    <>
      <SEO 
        exactTitle="Colorado Mortgage Calculator | Northern Colorado Home Payments | SAA Homes"
        description="Use our free mortgage calculator to estimate your monthly payments, understand how much home you can afford, and plan your home purchase in Northern Colorado."
        keywords="mortgage calculator, monthly payment calculator, home affordability calculator, Colorado mortgage calculator, real estate calculator"
        canonical="https://saahomes.com/mortgage-calculator/"
        ogTitle="Mortgage Calculator - Calculate Your Monthly Payments"
        ogDescription="Calculate your monthly mortgage payments and understand how much home you can afford with our free mortgage calculator."
        ogUrl="https://saahomes.com/mortgage-calculator/"
      />

      {/* Hero Section */}
      <section className="relative h-96 bg-cover bg-center flex items-center justify-center pt-32" 
        style={{backgroundImage: "url('/images/core-image-8.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-5xl sm:text-6xl font-bold font-serif">Mortgage Calculator</h1>
          <p className="mt-4 text-xl">Calculate Your Monthly Payments</p>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold font-serif mb-4">Mortgage Payment Calculator</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Use our mortgage calculator to estimate your monthly payments, understand how much home you can afford, and plan your home purchase in Northern Colorado.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <p className="text-center">
                <a href="https://www.mortgagecalculator.org/" target="_blank" rel="noopener noreferrer">
                  <img 
                    src="https://www.mortgagecalculator.org/images/mortgage-calculator-logo.png" 
                    alt="MortgageCalculator.org" 
                    className="max-w-full h-auto mx-auto"
                    style={{maxWidth: '100%'}}
                  />
                </a>
              </p>
            </div>
            
            <iframe 
              src="https://www.mortgagecalculator.org/webmasters/?downpayment=80000&homevalue=400000&loanamount=320000&interestrate=7&loanterm=30&propertytax=2700&pmi=1&homeinsurance=1500&monthlyhoa=0" 
              style={{width: '100%', height: '1200px', border: '0'}}
              title="Mortgage Calculator"
            ></iframe>

            <div style={{
              fontFamily: 'Arial',
              height: '36px',
              top: '-36px',
              padding: '0 8px 0 0',
              boxSizing: 'border-box',
              textAlign: 'right',
              background: '#f6f9f9',
              border: '1px solid #ccc',
              color: '#868686',
              lineHeight: '34px',
              fontSize: '12px',
              position: 'relative'
            }}>
              <a 
                style={{color: '#868686'}} 
                href="https://www.mortgagecalculator.org/free-tools/javascript-mortgage-calculator.php" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Javascript Mortgage Calculator
              </a> by MortgageCalculator.org
            </div>
          </div>
        </div>
      </section>

      {/* Get Pre-Approved CTA Section */}
      <section className="py-16 px-6" style={{backgroundColor: '#CFB36E'}}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4 text-gray-900">Get Pre-Approved</h2>
          <p className="text-lg text-gray-800 mb-8 max-w-2xl mx-auto">
            Now that you've calculated your estimated payments, take the next step and get pre-approved for a mortgage. Pre-approval shows sellers you're serious and helps you understand your exact budget. Connect with our trusted lending partners today.
          </p>
          <a href="/contact/" className="inline-block px-8 py-3 bg-gray-900 text-white font-semibold rounded hover:bg-gray-800 transition-colors">
            Apply Now
          </a>
        </div>
      </section>

      {/* Additional Information Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-6 text-center">Understanding Your Mortgage</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-3">Monthly Payment Breakdown</h3>
              <p className="text-gray-700 mb-4">
                Your monthly mortgage payment typically includes principal, interest, property taxes, homeowners insurance, and sometimes PMI (Private Mortgage Insurance).
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Principal:</strong> The amount you borrow</li>
                <li><strong>Interest:</strong> The cost of borrowing money</li>
                <li><strong>Property Taxes:</strong> Annual taxes divided by 12 months</li>
                <li><strong>Insurance:</strong> Homeowners insurance premium</li>
                <li><strong>PMI:</strong> Required if down payment is less than 20%</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3">Tips for Buyers</h3>
              <p className="text-gray-700 mb-4">
                Use this calculator to help determine your budget and understand what you can afford before you start house hunting.
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Get pre-approved before you start looking</li>
                <li>Consider all costs, not just the mortgage payment</li>
                <li>Factor in maintenance and utilities</li>
                <li>Work with a trusted lender for accurate rates</li>
                <li>Consult with a real estate agent for guidance</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold font-serif mb-4">Ready to Find Your Dream Home?</h2>
          <p className="text-xl mb-8">
            Now that you know what you can afford, let's start your home buying journey together.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors">
              Contact Us
            </a>
            <a href="/properties/" className="inline-block px-8 py-3 border-2 border-white text-white font-semibold rounded hover:bg-white hover:text-black transition-colors">
              View Properties
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

