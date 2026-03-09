/**
 * SmilecareSite — Full SmileCare Dental clinic website.
 *
 * Route: /smilecare (public, no auth)
 *
 * Design: DM Sans body, Playfair Display headings, teal #0B8FAC primary.
 * Sections: Nav, Hero, Services, About, Hours, Pricing, Contact, Footer.
 * SmilecareWidget floats bottom-right over all content.
 */

import { useEffect, useState } from 'react'
import SmilecareWidget from '../components/SmilecareWidget'

const TEAL    = '#0B8FAC'
const TEAL_D  = '#097a93'
const DARK    = '#0F1D2E'
const BODY    = '#4A5568'
const LIGHT   = '#F8FAFB'
const BORDER  = '#E5E7EB'

// Inject Google Fonts once
function useFonts() {
  useEffect(() => {
    if (document.getElementById('sc-fonts')) return
    const link = document.createElement('link')
    link.id   = 'sc-fonts'
    link.rel  = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap'
    document.head.appendChild(link)
  }, [])
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// ── SVG Components ────────────────────────────────────────────────────────────

function ToothLogo({ size = 22, color = 'white' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: 'block' }}>
      <path d="M12 2C9.24 2 7 4.24 7 7c0 1.74.89 3.28 2.25 4.2L8.25 19c-.11.82.49 1.56 1.31 1.63.82.07 1.54-.49 1.66-1.31L12 15.5l.78 3.82c.12.82.84 1.38 1.66 1.31.82-.07 1.42-.81 1.31-1.63l-1-7.8C16.11 10.28 17 8.74 17 7c0-2.76-2.24-5-5-5z" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SERVICES = [
  { emoji: '🦷', name: 'General Dentistry',  desc: 'Checkups, fillings, cleanings, and preventive care for the whole family.' },
  { emoji: '✨', name: 'Teeth Whitening',    desc: 'Professional in-chair whitening for a noticeably brighter smile in one visit.' },
  { emoji: '😁', name: 'Orthodontics',       desc: 'Traditional braces and clear aligners to align your teeth with confidence.' },
  { emoji: '🚨', name: 'Emergency Care',     desc: 'Same-day slots for dental pain, trauma, broken teeth, and urgent needs.' },
  { emoji: '🏆', name: 'Dental Implants',    desc: 'Permanent, natural-looking tooth replacements that last a lifetime.' },
  { emoji: '👶', name: "Kids' Dentistry",    desc: 'Gentle, child-friendly care in a warm environment kids actually enjoy.' },
]

const HOURS = [
  { day: 'Monday – Friday', time: '07:00 – 18:00', open: true  },
  { day: 'Saturday',         time: '08:00 – 14:00', open: true  },
  { day: 'Sunday',           time: 'Closed',         open: false },
  { day: 'Public Holidays',  time: 'Closed',         open: false },
]

const PRICING = [
  { name: 'Consultation',     price: 'R350',           note: 'Initial visit & assessment' },
  { name: 'Scale & Polish',   price: 'R450 – R650',    note: 'Professional cleaning'       },
  { name: 'Teeth Whitening',  price: 'From R2,800',    note: 'In-chair treatment'           },
  { name: 'Braces',           price: 'From R18,000',   note: 'Full orthodontic course'      },
  { name: 'Dental Implants',  price: 'From R22,000',   note: 'Per implant, all-inclusive'   },
  { name: "Kids' Visit",      price: 'From R280',      note: 'Under 12 years'               },
]

const MEDICAL_AIDS = ['Discovery Health', 'Momentum', 'Bonitas', 'Medihelp', 'Bestmed']

const DENTISTS = [
  'Dr Sipho Dlamini',
  'Dr Amina Patel',
  'Dr Gareth Williams',
  'Dr Naledi Mokoena',
]

const NAV_ITEMS = [
  { label: 'Services', target: 'services' },
  { label: 'About',    target: 'about'    },
  { label: 'Pricing',  target: 'pricing'  },
  { label: 'Contact',  target: 'contact'  },
]

// ── Shared style helpers ──────────────────────────────────────────────────────

const sectionLabel = {
  color: TEAL, fontWeight: 600, fontSize: 13,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  margin: '0 0 12px',
}

const sectionHeading = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 'clamp(28px, 4vw, 42px)',
  fontWeight: 700, color: DARK,
  margin: '0 0 16px', lineHeight: 1.2,
}

const pill = {
  border: `1.5px solid ${TEAL}`, color: TEAL,
  borderRadius: 24, padding: '5px 14px',
  fontSize: 13, fontWeight: 500,
  background: 'white', display: 'inline-block',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SmilecareSite() {
  useFonts()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const base = { fontFamily: "'DM Sans', sans-serif", color: DARK, background: 'white', overflowX: 'hidden' }

  return (
    <div style={base}>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100, background: 'white',
        borderBottom: `1px solid ${scrolled ? BORDER : 'transparent'}`,
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.07)' : 'none',
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 9, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ToothLogo size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: DARK, margin: 0, lineHeight: 1.2 }}>SmileCare Dental</p>
              <p style={{ fontSize: 10, color: TEAL, margin: 0, fontWeight: 600, letterSpacing: '0.08em' }}>SANDTON · ROSEBANK</p>
            </div>
          </button>

          {/* Nav links — hidden on mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_ITEMS.map(({ label, target }) => (
              <NavLink key={label} label={label} onClick={() => scrollTo(target)} />
            ))}
          </div>

          {/* CTA */}
          <TealButton onClick={() => scrollTo('contact')}>Book Appointment</TealButton>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(150deg, #F0F9FB 0%, #E6F4F8 55%, #FAFEFF 100%)', padding: '100px 24px 96px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', right: -80, top: -80, width: 480, height: 480, borderRadius: '50%', background: 'rgba(11,143,172,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -120, bottom: -120, width: 360, height: 360, borderRadius: '50%', background: 'rgba(11,143,172,0.04)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 80 }}>
          {/* Copy */}
          <div style={{ flex: 1, maxWidth: 600 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(11,143,172,0.1)', borderRadius: 24, padding: '6px 16px', marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: TEAL, display: 'inline-block' }} />
              <span style={{ fontSize: 13, color: TEAL, fontWeight: 600 }}>Sandton's Trusted Dental Practice</span>
            </div>

            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(38px, 5vw, 60px)', fontWeight: 700, color: DARK, lineHeight: 1.13, margin: '0 0 24px' }}>
              Your Smile Deserves<br />
              <span style={{ color: TEAL }}>World-Class Care</span>
            </h1>

            <p style={{ fontSize: 18, color: BODY, lineHeight: 1.75, margin: '0 0 40px', maxWidth: 500 }}>
              Sandton's most trusted dental practice — now with 24/7 intelligent patient support. Book appointments, get answers, and receive care that puts you first.
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <TealButton large onClick={() => scrollTo('contact')}>Book Appointment</TealButton>
              <OutlineButton large onClick={() => window.dispatchEvent(new Event('smilecare:open'))}>
                Chat with Lerato →
              </OutlineButton>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 52, display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              {[['15+', 'Years of Care'], ['6', 'Expert Dentists'], ['2', 'Branches']].map(([n, l]) => (
                <div key={l}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: TEAL, margin: 0, lineHeight: 1 }}>{n}</p>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <div style={{ flex: '0 0 360px', display: 'none' }} className="hero-img">
            <div style={{ width: 360, height: 420, borderRadius: 24, background: `linear-gradient(145deg, ${TEAL}, ${TEAL_D})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 32px 80px rgba(11,143,172,0.28)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
              <div style={{ position: 'absolute', bottom: -50, left: -30, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              <ToothLogo size={110} color="rgba(255,255,255,0.88)" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <p style={sectionLabel}>What We Offer</p>
            <h2 style={sectionHeading}>Comprehensive Dental Services</h2>
            <p style={{ color: '#6B7280', fontSize: 17, maxWidth: 460, margin: '0 auto' }}>
              From routine checkups to advanced procedures — expert dental care under one roof.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22 }}>
            {SERVICES.map(s => <ServiceCard key={s.name} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" style={{ padding: '96px 24px', background: LIGHT }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', gap: 80, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Image placeholder */}
          <div style={{ flex: '0 0 400px', height: 450, borderRadius: 24, background: `linear-gradient(145deg, ${TEAL}, ${TEAL_D})`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 24, right: 24, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', bottom: 24, left: 16, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            <ToothLogo size={96} color="rgba(255,255,255,0.85)" />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={sectionLabel}>About SmileCare</p>
            <h2 style={{ ...sectionHeading, marginBottom: 24 }}>Caring for Sandton's<br />Smiles Since 2009</h2>
            <p style={{ color: BODY, fontSize: 16, lineHeight: 1.8, marginBottom: 18 }}>
              Founded in 2009, SmileCare Dental has grown from a single Sandton practice into one of Johannesburg's most respected dental groups. Our team of six qualified dentists brings decades of combined experience across general, cosmetic, and specialist dentistry.
            </p>
            <p style={{ color: BODY, fontSize: 16, lineHeight: 1.8, marginBottom: 36 }}>
              From our flagship clinic at Sandton City Medical Suites to our satellite branch in Rosebank, we deliver world-class care in a warm, welcoming environment. Every patient is treated as family — because your smile matters to us.
            </p>

            {/* Dentist pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
              {DENTISTS.map(name => (
                <span key={name} style={pill}>{name}</span>
              ))}
            </div>

            {/* Feature dots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Medical aid accepted: Discovery, Momentum, Bonitas, Medihelp, Bestmed',
                'Same-day emergency appointments available',
                'Two branches: Sandton City & Rosebank',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: TEAL, flexShrink: 0, marginTop: 6 }} />
                  <span style={{ fontSize: 15, color: BODY }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Opening hours ── */}
      <section id="hours" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <p style={sectionLabel}>When We're Open</p>
          <h2 style={sectionHeading}>Opening Hours</h2>

          <div style={{ borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${BORDER}`, marginBottom: 24 }}>
            {HOURS.map(({ day, time, open }, i) => (
              <div key={day} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 28px',
                borderBottom: i < HOURS.length - 1 ? `1px solid ${BORDER}` : 'none',
                background: i % 2 === 0 ? 'white' : LIGHT,
              }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{day}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: open ? TEAL : '#EF4444' }}>{time}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 20px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📞</span>
            <p style={{ margin: 0, fontSize: 14, color: '#92400E', lineHeight: 1.6 }}>
              <strong>After-hours emergency line available.</strong> Call 011 234 5678 for urgent dental emergencies outside clinic hours.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '96px 24px', background: LIGHT }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <p style={sectionLabel}>Transparent Pricing</p>
            <h2 style={sectionHeading}>What to Expect</h2>
            <p style={{ color: '#6B7280', fontSize: 17, maxWidth: 440, margin: '0 auto 28px' }}>
              All prices include VAT. Medical aid claims processed on-site.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {MEDICAL_AIDS.map(m => (
                <span key={m} style={pill}>{m}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20 }}>
            {PRICING.map(p => <PriceCard key={p.name} {...p} />)}
          </div>

          <p style={{ textAlign: 'center', marginTop: 32, color: '#9CA3AF', fontSize: 14 }}>
            Prices are approximate. A full quote will be provided after your clinical assessment.
          </p>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <p style={sectionLabel}>Get in Touch</p>
            <h2 style={sectionHeading}>Book Your Appointment</h2>
            <p style={{ color: '#6B7280', fontSize: 17, maxWidth: 400, margin: '0 auto' }}>
              Reach us by phone, email, or chat with Lerato — we're here 24/7.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22, marginBottom: 56 }}>
            {[
              { icon: '📍', label: 'Address', value: 'Shop 14, Sandton City Medical Suites, Sandton, 2196' },
              { icon: '📞', label: 'Phone',   value: '011 234 5678',       href: 'tel:0112345678'              },
              { icon: '✉️', label: 'Email',   value: 'hello@smilecare.co.za', href: 'mailto:hello@smilecare.co.za' },
            ].map(c => <ContactCard key={c.label} {...c} />)}
          </div>

          {/* CTA banner */}
          <div style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_D})`, borderRadius: 24, padding: '60px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: -40, bottom: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, color: 'white', margin: '0 0 16px' }}>
              Ready to Book Your Visit?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, margin: '0 0 36px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Morning, afternoon, and Saturday slots available. Our team confirms within 2 hours.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="tel:0112345678"
                style={{ background: 'white', color: TEAL, borderRadius: 10, padding: '14px 32px', fontSize: 16, fontWeight: 700, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", display: 'inline-block' }}
              >
                Call 011 234 5678
              </a>
              <button
                onClick={() => window.dispatchEvent(new Event('smilecare:open'))}
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.6)', borderRadius: 10, padding: '14px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif' " }}
              >
                Chat with Lerato
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: DARK, padding: '48px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ToothLogo size={18} />
            </div>
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'white', margin: 0, fontSize: 15 }}>SmileCare Dental</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Sandton · Rosebank · Est. 2009</p>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>© 2025 SmileCare Dental. All rights reserved.</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: TEAL, fontWeight: 500 }}>Powered by intelligent patient support</p>
          </div>

          <div style={{ textAlign: 'right', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            <p style={{ margin: 0 }}>011 234 5678</p>
            <p style={{ margin: '4px 0 0', color: TEAL }}>hello@smilecare.co.za</p>
          </div>
        </div>
      </footer>

      {/* ── Floating chat widget (always on top) ── */}
      <SmilecareWidget />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavLink({ label, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: hov ? TEAL : BODY, transition: 'color 0.15s', padding: '4px 0' }}
    >
      {label}
    </button>
  )
}

function TealButton({ children, onClick, large }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? TEAL_D : TEAL,
        color: 'white', border: 'none', borderRadius: 10,
        padding: large ? '14px 32px' : '10px 22px',
        fontSize: large ? 16 : 14,
        fontWeight: 600, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 2px 12px rgba(11,143,172,0.32)',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function OutlineButton({ children, onClick, large }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#F0F9FB' : 'white',
        color: TEAL, border: `2px solid ${TEAL}`, borderRadius: 10,
        padding: large ? '14px 32px' : '10px 22px',
        fontSize: large ? 16 : 14,
        fontWeight: 600, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function ServiceCard({ emoji, name, desc }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1.5px solid ${hov ? TEAL : BORDER}`, borderRadius: 16,
        padding: '28px 26px',
        boxShadow: hov ? '0 8px 30px rgba(11,143,172,0.11)' : 'none',
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.22s', cursor: 'default',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EBF7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 24 }}>
        {emoji}
      </div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: DARK, margin: '0 0 10px' }}>{name}</h3>
      <p style={{ color: '#6B7280', fontSize: 15, lineHeight: 1.65, margin: 0 }}>{desc}</p>
    </div>
  )
}

function PriceCard({ name, price, note }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'white', borderRadius: 16, padding: '26px 26px',
        border: `1.5px solid ${hov ? TEAL : BORDER}`,
        boxShadow: hov ? '0 6px 24px rgba(11,143,172,0.1)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      <p style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{note}</p>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: DARK, margin: '0 0 8px' }}>{name}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: TEAL, margin: 0 }}>{price}</p>
    </div>
  )
}

function ContactCard({ icon, label, value, href }) {
  return (
    <div style={{ background: LIGHT, borderRadius: 16, padding: 26, border: `1.5px solid ${BORDER}` }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EBF7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 22 }}>{icon}</div>
      <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 6px' }}>{label}</p>
      {href
        ? <a href={href} style={{ fontSize: 16, color: TEAL, fontWeight: 600, textDecoration: 'none' }}>{value}</a>
        : <p style={{ fontSize: 15, color: DARK, fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{value}</p>
      }
    </div>
  )
}
