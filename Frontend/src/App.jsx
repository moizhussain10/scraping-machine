import React, { useState, useMemo, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Play, Database, Search, Calendar as CalendarIcon, Mail, Phone, ExternalLink, Download } from 'lucide-react';
import { io } from 'socket.io-client'; // Socket import karein
import './App.css';

const CLASS_LIST = [
  { val: "001", label: "001 Chemicals" }, { val: "002", label: "002 Paints" },
  { val: "003", label: "003 Cosmetics and cleaning preparations" }, { val: "004", label: "004 Lubricants and fuels" },
  { val: "005", label: "005 Pharmaceuticals" }, { val: "006", label: "006 Metal goods" },
  { val: "007", label: "007 Machinery" }, { val: "008", label: "008 Hand tools" },
  { val: "009", label: "009 Electrical and scientific apparatus" }, { val: "010", label: "010 Medical apparatus" },
  { val: "011", label: "011 Environmental control apparatus" }, { val: "012", label: "012 Vehicles" },
  { val: "013", label: "013 Firearms" }, { val: "014", label: "014 Jewelry" },
  { val: "015", label: "015 Musical instruments" }, { val: "016", label: "016 Paper goods and printed matter" },
  { val: "017", label: "017 Rubber goods" }, { val: "018", label: "018 Leather goods" },
  { val: "019", label: "019 Non-metallic building materials" }, { val: "020", label: "020 Furniture and articles" },
  { val: "021", label: "021 Housewares and glass" }, { val: "022", label: "022 Cordage and fibers" },
  { val: "023", label: "023 Yarns and threads" }, { val: "024", label: "024 Fabrics" },
  { val: "025", label: "025 Clothing" }, { val: "026", label: "026 Fancy goods" },
  { val: "027", label: "027 Floor coverings" }, { val: "028", label: "028 Toys and sporting goods" },
  { val: "029", label: "029 Meats and processed foods" }, { val: "030", label: "030 Staple foods" },
  { val: "031", label: "031 Natural agricultural products" }, { val: "032", label: "032 Light beverages" },
  { val: "033", label: "033 Wines and spirits" }, { val: "034", label: "034 Smokers' articles" },
  { val: "035", label: "035 Advertising and business" }, { val: "036", label: "036 Insurance and financial" },
  { val: "037", label: "037 Building construction and repair" }, { val: "038", label: "038 Telecommunication" },
  { val: "039", label: "039 Transportation and storage" }, { val: "040", label: "040 Treatment of materials" },
  { val: "041", label: "041 Education and entertainment" }, { val: "042", label: "042 Computer and scientific" },
  { val: "043", label: "043 Hotels and restaurants" }, { val: "044", label: "044 Medical, beauty and agricultural" },
  { val: "045", label: "045 Personal and legal" }, { val: "A", label: "A Certification mark for goods" },
  { val: "B", label: "B Certification mark for services" }, { val: "200", label: "200 Collective membership" }
];

const TAG_OPTIONS = [
  { value: "AD", label: "Abandonment date" }, { value: "AF", label: "Affidavit text" },
  { value: "AR", label: "Assignment recorded" }, { value: "AT", label: "Attorney of record" },
  { value: "CB", label: "Current basis" }, { value: "CC", label: "Coordinated class" },
  { value: "CD", label: "Cancellation date" }, { value: "CM", label: "Combined mark" },
  { value: "CM2", label: "Enhanced combined mark" }, { value: "CR", label: "Change in registration" },
  { value: "CU", label: "Concurrent use" }, { value: "CY", label: "Owner address city" },
  { value: "DC", label: "Design code" }, { value: "DD", label: "Design description" },
  { value: "DE", label: "Description of mark" }, { value: "DS", label: "Disclaimer" },
  { value: "EN", label: "Owner entity" }, { value: "FD", label: "Filing date" },
  { value: "FM", label: "Full mark" }, { value: "GS", label: "Goods and services" },
  { value: "GS2", label: "Enhanced goods and services" }, { value: "GS3", label: "Expanded goods and services" },
  { value: "IC", label: "International class" }, { value: "IR", label: "International registration number" },
  { value: "LD", label: "Live dead indicator" }, { value: "LR", label: "Live registrations" },
  { value: "MD", label: "Mark drawing code" }, { value: "MN", label: "Mark not-punctuated" },
  { value: "MP", label: "Mark punctuated" }, { value: "OB", label: "Original basis" },
  { value: "OD", label: "Other data" }, { value: "ON", label: "Owner name" },
  { value: "OT", label: "Owner type" }, { value: "OW", label: "Owner name/address" },
  { value: "PC", label: "Pseudo class" }, { value: "PD", label: "Priority date" },
  { value: "PE", label: "TTAB proceeding number" }, { value: "PM", label: "Pseudo mark" },
  { value: "PM2", label: "Enhanced pseudo mark" }, { value: "PO", label: "Published for opposition date" },
  { value: "PR", label: "Prior registration number" }, { value: "RD", label: "Registration date" },
  { value: "RE", label: "Renewal" }, { value: "RG", label: "Register" },
  { value: "RN", label: "Registration number" }, { value: "RW", label: "Renewal date" },
  { value: "SA", label: "Status" }, { value: "SC", label: "Owner address state/country" },
  { value: "SN", label: "Serial number" }, { value: "SR", label: "Supplemental register date" },
  { value: "ST", label: "Standard characters" }, { value: "TD", label: "Total designs" },
  { value: "TF", label: "Distinctiveness limitation" }, { value: "TL", label: "Translation" },
  { value: "TL2", label: "Enhanced translation" }, { value: "TM", label: "Type of mark" },
  { value: "TN", label: "Transliteration" }, { value: "TP", label: "Number of pseudo classes" },
  { value: "TT", label: "Translation and transliteration" }, { value: "U1", label: "First use date" },
  { value: "U2", label: "First use in commerce date" }, { value: "UD", label: "Update date" }
];

const MAIN_FILTERS = ["General search", "Wordmark", "Goods and services", "Owner", "Serial number", "Registration number", "Mark description", "Field tag and Search builder"];

const DATE_TAGS = ["AD", "CD", "FD", "PD", "PO", "RD", "RW", "SR", "U1", "U2", "UD"];
const STATUS_TAGS = ["LD"]; // Tags that use LIVE/DEAD
const BOOLEAN_TAGS = ["AR", "ST", "LR"]; // Tags that use true/false
const CLASS_TAGS = ["CC", "IC"];

function App() {
  const [mainFilter, setMainFilter] = useState(MAIN_FILTERS[7]);
  const [selectedTag, setSelectedTag] = useState(TAG_OPTIONS[0]);
  const [operator, setOperator] = useState("CONTAINS");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);
  const [builderText, setBuilderText] = useState(""); // Niche wale box ki typing
  const [mainSearchValue, setMainSearchValue] = useState(""); // UUPER wale main box ki typing
  const [boolValue, setBoolValue] = useState("true");
  const [statusValue, setStatusValue] = useState("LIVE");
  const [classValue, setClassValue] = useState(CLASS_LIST[0].val);
  const [isScanning, setIsScanning] = useState(false);
  const [leads, setLeads] = useState(() => {
    const saved = localStorage.getItem('uspto_leads');
    return saved ? JSON.parse(saved) : [];
  });


  useEffect(() => {
    localStorage.setItem('uspto_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('new-lead', (data) => {
      // Check karo ke data sahi hai aur owners ka array mojud hai
      if (data && data.owners && Array.isArray(data.owners)) {

        // Yahan loop chala kar har owner ki alag entry bana rahe hain
        const formattedEntries = data.owners.map(o => ({
          markName: data.markName || "N/A",
          serialNum: data.serial || "N/A",
          owner: o.owner || "N/A",
          phone: o.phone || "N/A",
          email: o.email || "N/A",
          status: "Dead"
        }));

        // Ab leads state mein saare owners ko ek sath bhej do
        setLeads((prevLeads) => {
          // Sirf wo entries add karo jo list mein pehle se nahi hain
          const newOnes = formattedEntries.filter(entry =>
            !prevLeads.some(p => p.serialNum === entry.serialNum && p.owner === entry.owner)
          );
          return [...newOnes, ...prevLeads];
        });
      }
    });

    socket.on('scanning-stopped', () => {
      setIsScanning(false);
    });

    return () => socket.disconnect();
  }, []);


  const inputType = useMemo(() => {
    if (DATE_TAGS.includes(selectedTag.value)) return 'date';
    if (STATUS_TAGS.includes(selectedTag.value)) return 'status';
    if (BOOLEAN_TAGS.includes(selectedTag.value)) return 'bool';
    if (CLASS_TAGS.includes(selectedTag.value)) return 'class';
    return 'text';
  }, [selectedTag]);

  // Ye sirf Query generate kar ke uuper wale box mein pheinkega
  const handleBuildQuery = () => {
    let generated = "";

    // Sahi date format build karne ka function (Local Time)
    const formatLocal = (date) => {
      if (!date) return "";
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
    };

    if (inputType === 'date') {
      const start = formatLocal(startDate);
      // Agar endDate nahi hai toh start date ko hi end date bana do
      const end = endDate ? formatLocal(endDate) : start;
      generated = `${selectedTag.value}:[${start} TO ${end}]`;
    } else if (inputType === 'status') {
      generated = `${selectedTag.value}:${statusValue}`;
    } else if (inputType === 'bool') {
      generated = `${selectedTag.value}:${boolValue}`;
    } else if (inputType === 'class') {
      generated = `${selectedTag.value}:${classValue}`;
    } else {
      let val = builderText.trim();
      if (operator === "STARTS") val = `${val}*`;
      if (operator === "EXACT") val = `"${val}"`;
      generated = `${selectedTag.value}:${val}`;
    }

    setMainSearchValue(generated);
    // Baki fields reset...
    setBuilderText("");
    setStartDate(new Date());
    setEndDate(null);
  };

  const handleFinalSearch = async () => {
    setLeads([]);
    setIsScanning(true);

    try {
      await fetch('http://localhost:5000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mainSearchValue })
      });
    } catch (err) {
      setIsScanning(false);
      console.error("Backend se connect nahi ho paya", err);
    }
  };

  const handleClearLeads = () => {
    if (window.confirm("Saara data delete kar dein?")) {
      setLeads([]);
      localStorage.removeItem('uspto_leads');
    }
  };

  const handleDownloadCSV = () => {
    if (leads.length === 0) {
      alert("Bhai, pehle data toh nikalne do!");
      return;
    }


    // 1. Headers (Wahi format jo tune sheet mein dikhaya tha)
    const headers = ["Name", "Number", "Email", "Trademark name", "Serial", "Status"];

    // 2. Data Rows
    const rows = leads.map(lead => [
      `"${lead.owner}"`,
      `"${lead.phone}"`,
      `"${lead.email}"`,
      `"${lead.markName}"`,
      `"${lead.serialNum}"`,
      `"${lead.status || 'Dead'}"`
    ]);

    // 3. Combine to CSV String
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    // 4. Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `USPTO_Leads_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl">
        <header>
          <div className="title"><Database /> USPTO Lead Hunter</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* 📥 DOWNLOAD BUTTON */}
            {leads.length > 0 && (
              <button
                className="download-btn"
                onClick={handleDownloadCSV}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
              >
                <Download size={18} /> Export CSV
              </button>
            )}
            {/* 🚀 CHANGE 3: Clear Button UI */}
            {leads.length > 0 && (
              <button className="clear-btn" onClick={handleClearLeads}>Clear All</button>
            )}
            <span className={`status-badge ${isScanning ? 'scanning' : ''}`}>
              {isScanning ? 'Hunting Leads...' : 'System Ready'}
            </span>
          </div>
        </header>

        <div className="uspto-search-container">
          <div className="search-bar-main">
            <select className="main-filter-select" value={mainFilter} onChange={(e) => { setMainFilter(e.target.value); setMainSearchValue(""); }}>
              {MAIN_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            {/* AB YAHAN TYPE BHI HOGA AUR DELETE BHI */}
            <input
              type="text"
              className="search-input-field"
              placeholder="Type query or build from below..."
              value={mainSearchValue}
              onChange={(e) => setMainSearchValue(e.target.value)}
            />

            <button className="search-icon-btn" onClick={handleFinalSearch}><Search size={20} /></button>
          </div>

          {mainFilter === "Field tag and Search builder" && (
            <div className="advanced-builder-panel animate-in">
              <div className="builder-grid">
                <div className="input-group">
                  <label>Select Field Tag</label>
                  <input list="tags" className="simple-search-input" placeholder="Search Tag..." onChange={(e) => {
                    const found = TAG_OPTIONS.find(t => t.value === e.target.value || t.label === e.target.value);
                    if (found) setSelectedTag(found);
                  }} />
                  <datalist id="tags">{TAG_OPTIONS.map((t, i) => <option key={i} value={t.label}>{t.label}</option>)}</datalist>
                </div>

                <div className="input-group">
                  <label>Value Field</label>
                  {inputType === 'date' ? (
                    <div className="calendar-wrapper">
                      <DatePicker selectsRange startDate={startDate} endDate={endDate} onChange={(u) => { setStartDate(u[0]); setEndDate(u[1]); }} className="date-input" />
                      <CalendarIcon className="calendar-icon" size={16} />
                    </div>
                  ) : inputType === 'status' ? (
                    <select className="simple-search-input" value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                      <option value="LIVE">LIVE</option><option value="DEAD">DEAD</option>
                    </select>
                  ) : inputType === 'class' ? (
                    <select className="simple-search-input" value={classValue} onChange={(e) => setClassValue(e.target.value)}>
                      {CLASS_LIST.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                    </select>
                  ) : inputType === 'bool' ? (
                    <select className="simple-search-input" value={boolValue} onChange={(e) => setBoolValue(e.target.value)}>
                      <option value="true">True (Yes)</option><option value="false">False (No)</option>
                    </select>
                  ) : (
                    <input type="text" className="simple-search-input" placeholder="Value..." value={builderText} onChange={(e) => setBuilderText(e.target.value)} />
                  )}
                </div>

                <div className="btn-wrapper">
                  <button className="btn-start" onClick={handleBuildQuery}><Play size={18} /> Build</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="table-container animate-in">
          <table>
            <thead>
              <tr>
                <th>Mark Detail</th>
                <th>Owner</th>
                <th>Lead Contact</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length > 0 ? leads.map((lead, index) => (
                <tr key={index}>
                  <td>
                    <div className="trademark-wrapper">
                      <span className="trademark-name">{lead.markName}</span>
                      <span className="serial-num"># {lead.serialNum}</span>
                    </div>
                  </td>
                  <td>
                    <div className="owner-info">
                      <div className="owner-avatar">
                        {lead.owner.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{lead.owner}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="contact-cell">
                      <div className="contact-item">
                        <Phone size={14} />
                        <span>{lead.phone !== "N/A" ? lead.phone : "No Phone"}</span>
                      </div>
                      <div className="contact-item">
                        <Mail size={14} />
                        <span>{lead.email !== "N/A" ? lead.email : "Hidden Email"}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${(lead.status || 'unknown').toLowerCase()}`}>
                      <span className="status-dot"></span>
                      {lead.status || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        className="view-btn"
                        title="View on USPTO"
                        onClick={() => window.open(`https://tsdr.uspto.gov/#caseNumber=${lead.serialNum}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`, '_blank')}
                      >
                        <ExternalLink size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="empty-row">
                    <div className="empty-state-box">
                      <Search size={48} opacity={0.2} />
                      <p>No active leads found. Enter a query to start hunting.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
