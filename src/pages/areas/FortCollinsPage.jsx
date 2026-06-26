import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import AreaFAQSection from "../../components/AreaFAQSection.jsx";
import { AREA_FAQS } from "../../data/areaFaqs.js";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function FortCollinsPage() {
  return (
    <>
      <AreaSEO slug="fort-collins" />
      
      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Fort-Collins-CO-Area-Guide.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Fort Collins, CO</h1>
          <p className="mt-4 text-xl">A vibrant city with CSU, craft breweries, and stunning mountain views</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/properties/?location=Fort Collins, CO" className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Search Fort Collins Homes
            </a>
            <a href="/contact/" className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors">
              Talk to an Agent
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Area Guide Intro */}
        <section className="mb-12">
          <h2 className="text-4xl font-bold mb-6">Fort Collins, CO Area Guide</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is a vibrant and diverse city. From the breathtaking Rocky Mountains to the bustling downtown area, Fort Collins is the perfect destination for anyone looking to experience the best of Colorado living.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Whether you're looking to visit Fort Collins, buy a home and get involved in the community, or just enjoy the outdoors, there is something for everyone here! Fort Collins is the perfect place to call home with its beautiful mountain views, excellent schools, and thriving economy.
            </p>
          </div>
        </section>

        {/* Property Search CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Search Homes in Fort Collins</h2>
            <p className="text-lg mb-6 text-gray-700">
              Explore available properties in Fort Collins, CO
            </p>
            <Link
              to="/properties/?location=Fort Collins, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search Fort Collins Homes
            </Link>
          </div>
        </section>

        {/* Moving to Fort Collins */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Moving to Fort Collins, CO - Here's what it's like living in Fort Collins!</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is a vibrant and diverse city. From the breathtaking Rocky Mountains to the bustling downtown area, Fort Collins is the perfect destination for anyone looking to experience the best of Colorado living.
            </p>
          </div>
        </section>

        {/* Economy */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Fort Collins Economy -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is a thriving city with a booming economy, with a population of 168,538. The city was recently recognized as one of the most economically vibrant cities in America by the Milken institute in 2017. This recognition is no surprise to many residents who have seen the impressive growth and development within our economy over the past several years. The city's employment rate has grown steadily year after year and continues to outpace national job market averages. With a highly educated population and a diverse economic base that includes technology, manufacturing, agriculture, tourism, education, retail, and healthcare industries – it's easy to see why Fort Collins is thriving economically.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              In addition to its growing job market, Fort Collins boasts strong housing markets with median home prices well above the national average. With its low unemployment rate, excellent schools, and plenty of job opportunities, Fort Collins is an ideal destination for those looking to pursue their career or start their own business.
            </p>
          </div>
        </section>

        {/* Culture and Activities */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Culture and Activities in Fort Collins -</h2>
          <div className="prose prose-lg max-w-none">
            <div className="mb-6">
              <img 
                src="/images/Fort-Collins-CO-Area-Guide.jpg" 
                alt="Fort Collins Colorado downtown and Colorado State University" 
                className="w-full rounded-lg shadow-lg"
                loading="lazy"
              />
            </div>
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is home to a diverse and friendly population. From the students who attend Colorado State University to the families that have been living there for generations, this warm and welcoming city has something for everyone. Whether you're looking for vibrant downtown nightlife with over 85 restaurants, or a quiet neighborhood, there are plenty of options to suit your needs.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The culture in Fort Collins is also rich with attractions such as museums, galleries, performing arts centers, music venues that host local events, including music, concerts, and festivals. A favorite of the community is the Taste of Fort Collins is an annual three-day festival with family-friendly activities, food from local restaurants, and acclaimed musicians. Summertime is full of fun and music entertainment with options such as the Lagoon Concert Series at CSU, Bohemian Nights Thursday Night Live, or The Lincoln Center's Children's Concert Series. When August rolls around, make sure to show up for all things Peach and attend The Peach Festival! The winter months are a bit colder, but the community stays warm and vibrant with the annual Holiday Lighting Ceremony of thousands of LED lights which create a nostalgic experience.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is a great destination for families, with a variety of activities to enjoy. For active kids, there is the Fly High Adventure Park, an indoor trampoline park located at the base of the Front Range mountains. The Fort Collins Museum of Discovery is a great place to learn and have fun, with interactive exhibits, a plesiosaur, and music experiences. The Urban Air Adventure Park is an indoor amusement park with trampolines, obstacle courses, and a ninja warrior course. Skating enthusiasts can have a blast at the Rollerland Skate Center, and kids who love puzzles can test their skills at Somewhere Secret Escape Game. For even more fun, there is Fort Fun, a family entertainment center with mini golf, go-karts, laser tag, and more, and Mountain Kids, an indoor rock climbing gym. These are just a few of the many fun things to do in Fort Collins with kids.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is the craft brew hub of Colorado, with over 20 craft breweries, including the fourth largest in the U.S., New Belgium Brewing Co. Other local favorites include Odell Brewing Company, and Zwei Brewing Co. You'll need a FoCo Beer Map and multiple days to truly experience the craft beer scene!
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins, Colorado, is the perfect place to explore the great outdoors. The city, located along the Cache La Poudre River in Larimer County, provides a wealth of outdoor activities for visitors and residents alike. Fort Collins is nestled in the foothills of the Rocky Mountains, offering plenty of outdoor activities for all ages. With the Cache La Poudre River running through town, it's a great place for fishing, kayaking, or just taking in stunning views. There are also plenty of trails for hikers and bikers and numerous parks to explore.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              From hiking through Lory State Park to biking along miles of trails and fishing on Horsetooth Reservoir, there is something for everyone looking to experience nature at its finest. The nearby Rocky Mountain National Park offers over 300 miles of trails that range from easy day hikes to more challenging backpacking trips. There are also many options for rock climbing as well as plenty of opportunities for camping and taking in incredible views of the surrounding area. For those who prefer a slower pace, Fort Collins also has plenty of parks with picnic areas and open spaces where you can relax and enjoy the fresh air.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The culture in Fort Collins is also rich with attractions such as museums, galleries, performing arts centers, music venues, and more! With so much to do, it's no wonder Fort Collins continues to attract visitors from all over the world year after year.
            </p>
          </div>
        </section>

        {/* Education */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Education in Fort Collins -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              From elementary schools to universities, Fort Collins is filled with educational opportunities for students of all ages. It is home to several institutions of higher education, including Colorado State University (CSU), Front Range Community College (FRCC), and IBMC.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Colorado State University is a public research university with diverse academic programs, including engineering, natural sciences, business, and liberal arts. The university is known for its strong focus on hands-on learning and research opportunities, with students participating in internships, co-ops, and research projects as part of their education. CSU is located in the heart of Fort Collins and is a major contributor to the city's economic and cultural life.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Front Range Community College is a two-year public college offering a range of associate degrees and certificate programs in healthcare, business, and technology. The college has several Fort Collins campuses, including Westminster's main campus and satellite locations in Longmont and Brighton.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              IBMC is a two-year public community college that offers associate degrees and certificates for students looking to pursue careers in healthcare, technology, and business. The college has multiple campus locations throughout Northern Colorado, including one in Fort Collins.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              In addition to these institutions, Fort Collins is home to several K-12 public and private schools, including Poudre School District, which serves the city and surrounding areas. The district carries an A rating with Niche, and is ranked the 13th-best school district in the state. There is also a large variety of public charter and private schools, including Liberty Common Charter, and Ridgeview Classical Charter.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Overall, Fort Collins has a strong education system that provides a range of options for students of all ages.
            </p>
          </div>
        </section>

        {/* Location and Climate */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Location and Climate of Fort Collins -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins, Colorado is a city located in Northern Colorado. Situated at the foot of the Rocky Mountains, the city has an elevation of 4,982 feet and offers stunning views of both mountains and plains. Fort Collins is just 60 miles north of Denver and easily accessible by I-25.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The city's geographical location provides a unique climate; it receives plenty of winter snowfall yet remains relatively cool year-round. Temperatures during summer rarely exceed 90 degrees Fahrenheit, and with over 300 days of sunshine a year, it makes for a wonderful climate to experience the outdoors year-round.
            </p>
          </div>
        </section>

        {/* 10 Facts */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">10 Facts About Fort Collins, Colorado</h2>
          <div className="prose prose-lg max-w-none">
            <ul className="list-disc list-inside space-y-3 text-lg">
              <li>Fort Collins is home to Colorado State University, a major research university</li>
              <li>The city has over 20 craft breweries, making it a craft beer destination</li>
              <li>Fort Collins has over 300 days of sunshine per year</li>
              <li>The city is located at 4,982 feet elevation at the base of the Rocky Mountains</li>
              <li>Fort Collins has a population of approximately 168,538 residents</li>
              <li>The Poudre School District is ranked 13th-best in Colorado</li>
              <li>Fort Collins is just 60 miles north of Denver</li>
              <li>The city hosts the annual Taste of Fort Collins festival</li>
              <li>Fort Collins is home to New Belgium Brewing, the fourth largest craft brewery in the U.S.</li>
              <li>The city has over 85 restaurants in its vibrant downtown area</li>
            </ul>
          </div>
        </section>

        {/* Market Report CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Fort Collins, CO?</h2>
            <p className="text-lg mb-6 text-center text-gray-700">
              We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
            </p>
            <MarketReportForm areaName="Fort Collins, CO" />
            <p className="text-center text-gray-500 text-sm mt-4">
              Or call us at <a href="tel:(970) 999-1407" className="text-black font-semibold hover:underline">(970) 999-1407</a> for a personalized market report
            </p>
          </div>
        </section>

        {/* Area Highlights */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Area Highlights</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              A quick view of the most influential metrics in Fort Collins, CO.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              In the fantastic area of Fort Collins, CO you'll be in good company with around 173,211 residents with around 55% of those homeowners. With an average age of 31, Fort Collins, CO has a fairly young population filled with young professionals, new parents, and new homeowners. Over the past 6 months, roughly 155 homes have been sold with an average sold price of $636,292. That is an increase of $6,148 from the previous period.
            </p>
          </div>
        </section>

        {/* Around The Area - Restaurants */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Around The Area</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-3">The Colorado Room</h3>
              <p className="text-gray-700">A local favorite for craft beer and American cuisine</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Social</h3>
              <p className="text-gray-700">Modern American restaurant with creative cocktails</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">The Regional</h3>
              <p className="text-gray-700">Farm-to-table dining featuring regional ingredients</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">The Still Whiskey Steaks</h3>
              <p className="text-gray-700">Upscale steakhouse with an extensive whiskey selection</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Persimmon</h3>
              <p className="text-gray-700">Contemporary American cuisine in a stylish setting</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">The Farmhouse at Jessup Farm</h3>
              <p className="text-gray-700">Rustic farm-to-table restaurant in a historic setting</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Maida Trattoria</h3>
              <p className="text-gray-700">Authentic Italian cuisine and pasta</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Smōk</h3>
              <p className="text-gray-700">Modern barbecue restaurant with creative sides</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Indigo: Modern Indian Cuisine & Bar</h3>
              <p className="text-gray-700">Contemporary Indian dishes and craft cocktails</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Bistro Nautile</h3>
              <p className="text-gray-700">French-inspired bistro with seasonal menus</p>
            </div>
          </div>
        </section>

        {/* Schools */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Schools In The Area</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Fort Collins is served by the Poudre School District, which carries an A rating with Niche and is ranked the 13th-best school district in Colorado. The district includes numerous elementary, middle, and high schools, as well as charter schools like Liberty Common Charter and Ridgeview Classical Charter. Higher education options include Colorado State University, Front Range Community College, and IBMC.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-gray-900 text-white p-12 rounded-lg">
          <h2 className="text-3xl font-bold mb-4">Ready to Explore Fort Collins?</h2>
          <p className="text-xl mb-6">
            This isn't just a job, it's what we love to do. We wake up in the morning focused on your real estate goals, eager to help our clients succeed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.realscout.com/search?agent_id=251929&location=Fort%20Collins,%20CO"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold rounded hover:bg-gray-100 transition-colors"
            >
              Search Homes in Fort Collins
            </a>
            <Link
              to="/contact/"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded hover:bg-white/10 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </article>

      <AreaFAQSection faqs={AREA_FAQS['fort-collins']} city="Fort Collins" />

    </>
  );
}

