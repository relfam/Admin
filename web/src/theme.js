import {
  LayoutDashboard, Users, CalendarDays, Gift, CreditCard, Home, FileText,
  BarChart3, Bell, LifeBuoy, FolderOpen, Settings, ShieldCheck, ScrollText, Megaphone, MessageSquare, Lightbulb, Activity,
} from "lucide-react";

export const C = {
  primary: "#5B8DEF", primarySoft: "#EEF3FE", pink: "#F6B8C8", pinkSoft: "#FDF1F4",
  gold: "#D4AF37", goldSoft: "#FBF6E4", success: "#22C55E", successSoft: "#EAFBF0",
  warning: "#F59E0B", warningSoft: "#FEF6E7", error: "#EF4444", errorSoft: "#FDEEEE",
  bg: "#F8FAFC", card: "#FFFFFF", border: "#E5E7EB", text: "#111827", sub: "#6B7280",
};

export const css = `
  * { box-sizing: border-box; }
  .rf-root { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${C.text}; background: ${C.bg}; -webkit-font-smoothing: antialiased; }
  .rf-card { background: #fff; border: 1px solid ${C.border}; border-radius: 16px; transition: box-shadow .25s ease, transform .25s ease; }
  .rf-card.hoverable:hover { box-shadow: 0 12px 32px rgba(17,24,39,.08); transform: translateY(-2px); }
  .rf-side-item { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; cursor:pointer; color:${C.sub}; font-size:13.5px; font-weight:500; transition: background .2s, color .2s; white-space:nowrap; }
  .rf-side-item:hover { background:${C.primarySoft}; color:${C.primary}; }
  .rf-side-item.active { background:${C.primary}; color:#fff; box-shadow: 0 6px 16px rgba(91,141,239,.35); }
  .rf-btn { display:inline-flex; align-items:center; gap:8px; border-radius:12px; font-size:13px; font-weight:600; padding:9px 16px; cursor:pointer; border:1px solid transparent; transition: all .2s; }
  .rf-btn.primary { background:${C.primary}; color:#fff; }
  .rf-btn.primary:hover { background:#4a7de3; box-shadow:0 6px 16px rgba(91,141,239,.35); }
  .rf-btn.ghost { background:#fff; border-color:${C.border}; color:${C.text}; }
  .rf-btn.ghost:hover { border-color:${C.primary}; color:${C.primary}; }
  .rf-btn.danger { background:${C.error}; color:#fff; }
  .rf-btn.danger:hover { background:#dc2626; }
  .rf-btn:disabled { opacity:.5; cursor:not-allowed; }
  .rf-btn:focus-visible, .rf-side-item:focus-visible, .rf-icon-btn:focus-visible { outline: 2px solid ${C.primary}; outline-offset: 2px; }
  .rf-icon-btn { width:38px; height:38px; display:flex; align-items:center; justify-content:center; border-radius:12px; border:1px solid ${C.border}; background:#fff; color:${C.sub}; cursor:pointer; transition:all .2s; }
  .rf-icon-btn:hover { color:${C.primary}; border-color:${C.primary}; }
  .rf-table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
  .rf-table thead th { position:sticky; top:0; background:#F9FAFB; color:${C.sub}; font-weight:600; font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; text-align:left; padding:12px 16px; border-bottom:1px solid ${C.border}; z-index:2; }
  .rf-table tbody td { padding:14px 16px; border-bottom:1px solid #F1F3F6; vertical-align:middle; }
  .rf-table tbody tr { transition: background .15s; }
  .rf-table tbody tr:hover { background:#F8FAFF; }
  .rf-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .rf-input { width:100%; border:1px solid ${C.border}; border-radius:12px; padding:10px 14px 10px 40px; font-size:13.5px; background:#fff; transition:border .2s, box-shadow .2s; font-family:inherit; }
  .rf-input.plain { padding-left:14px; }
  .rf-input:focus { outline:none; border-color:${C.primary}; box-shadow:0 0 0 3px rgba(91,141,239,.15); }
  select.rf-input { appearance:auto; }
  .rf-tab { padding:10px 4px; margin-right:24px; font-size:13.5px; font-weight:600; color:${C.sub}; border-bottom:2px solid transparent; cursor:pointer; transition:all .2s; }
  .rf-tab.active { color:${C.primary}; border-color:${C.primary}; }
  .rf-fade { animation: rfFade .35s ease; }
  @keyframes rfFade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  .rf-drawer { animation: rfSlide .3s cubic-bezier(.2,.8,.3,1); }
  @keyframes rfSlide { from { transform: translateX(60px); opacity:0; } to { transform:none; opacity:1; } }
  .rf-pop { animation: rfPop .22s cubic-bezier(.2,.8,.3,1); }
  @keyframes rfPop { from { transform: scale(.96) translateY(8px); opacity:0; } to { transform:none; opacity:1; } }
  .rf-spin { animation: rfSpin .8s linear infinite; }
  @keyframes rfSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .rf-fade, .rf-drawer, .rf-pop, .rf-card { animation:none !important; transition:none !important; } .rf-spin { animation:none !important; } }
  ::-webkit-scrollbar { width:8px; height:8px; } ::-webkit-scrollbar-thumb { background:#D8DEE8; border-radius:8px; }
`;

export const AV_COLORS = ["#5B8DEF", "#D4AF37", "#F6B8C8", "#22C55E", "#F59E0B", "#8B5CF6"];
export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export const MENU = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "gifts", label: "Gift Records", icon: Gift },
  { id: "payments", label: "Packages & Payments", icon: CreditCard },
  { id: "families", label: "Family Accounts", icon: Home },
  { id: "fraud", label: "Fraud & Spam", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ads", label: "Advertisements", icon: Megaphone },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "referrals", label: "Referral Payouts", icon: Gift },
  { id: "interest", label: "Feature Interest", icon: Lightbulb },
  { id: "content", label: "Content Management", icon: FolderOpen },
  { id: "health", label: "System Health", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "admins", label: "Admin Management", icon: ShieldCheck },
  { id: "audit", label: "Audit Logs", icon: ScrollText },
];

// Copy/asset catalogs — onboarding illustrations, event themes, translation progress, legal docs.
// These aren't user-generated records like Users/Events/Gifts; there's no backing table for them
// yet, so they stay as static reference content rather than fabricated "live" data.
export const AD_EVENT_TYPES = ["All types", "Wedding", "Birthday", "Housewarming", "Baby Shower", "Engagement", "Anniversary"];

// Matches INDIAN_STATES in EventX-mobile-latest/www/index.html's Edit Profile screen exactly —
// ad location targeting only works if both sides draw from the same fixed list.
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry", "Other / Outside India",
];

// Sourced from a 2022+ district-boundary dataset (post AP/TN/Telangana reorganizations) — used to
// build the cascading state->district multi-select on Ads/Notifications targeting, and the mobile
// app's own Edit Profile district field, so both sides draw from exactly the same canonical names.
export const STATE_DISTRICTS = {
  "Andhra Pradesh": ["Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla", "Chittoor", "Dr. B.R. Ambedkar Konaseema", "East Godavari", "Eluru", "Guntur", "Kakinada", "Krishna", "Kurnool", "NTR", "Nandyal", "Palnadu", "Parvathipuram Manyam", "Prakasam", "Sri Potti Sriramulu Nellore", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR"],
  "Arunachal Pradesh": ["Anjaw", "Changlang", "East Kameng", "East Siang", "Itanagar capital complex", "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke-Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Dibang Valley", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"],
  "Assam": ["Baksa", "Barpeta", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
  "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur-Ramanujganj", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon", "Korba", "Korea", "Mahasamund", "Manendragarh-Chirmiri-Bharatpur", "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sarangarh-Bilaigarh", "Shakti", "Sukma", "Surajpur", "Surguja"],
  "Goa": ["North Goa", "South Goa"],
  "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhumi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
  "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
  "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribag", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela-Kharsawan", "Simdega", "West Singhbhum"],
  "Karnataka": ["Bagalakote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagara", "Chikkaballapura", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwada", "Gadaga", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppala", "Mandya", "Mysuru", "Raichuru", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgiri"],
  "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
  "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
  "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
  "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "Eastern West Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
  "Mizoram": ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"],
  "Nagaland": ["Chümoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyü", "Tuensang", "Wokha", "Zunheboto"],
  "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Debagarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"],
  "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Firozpur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"],
  "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  "Sikkim": ["East Sikkim", "North Sikkim", "Pakyong", "Soreng", "South Sikkim", "West Sikkim"],
  "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupattur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
  "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahbubnagar", "Mancherial", "Medak", "Medchal–Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
  "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Bagpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur Kheri", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
  "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
  "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Maldah", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"],
  "Andaman and Nicobar Islands": ["Nicobar", "North and Middle Andaman", "South Andaman"],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara district", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "Jammu and Kashmir": ["Anantnag", "Bandipore", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
  "Ladakh": ["Kargil", "Leh"],
  "Lakshadweep": ["Lakshadweep"],
  "Puducherry": ["Karaikal", "Mahé", "Puducherry", "Yanam"],
  "Other / Outside India": [],
};

export const ONBOARDING_ITEMS = [
  { id: "o1", title: "Screen 1 — Never forget who gave what", note: "Tamil + English copy · Illustration v3" },
  { id: "o2", title: "Screen 2 — Record moi in seconds", note: "Tamil + English copy · Illustration v3" },
  { id: "o3", title: "Screen 3 — Collect via QR at the venue", note: "Tamil + English copy · Illustration v2" },
  { id: "o4", title: "Screen 4 — Share with your whole family", note: "Tamil + English copy · Illustration v2" },
];

export const THEME_ITEMS = [
  { id: "t1", title: "Wedding — Maroon & gold", note: "Live" }, { id: "t2", title: "Valaikappu — Yellow & green", note: "Live" },
  { id: "t3", title: "Grihapravesam — Kolam motif", note: "Live" }, { id: "t4", title: "Birthday — Confetti", note: "Live" },
  { id: "t5", title: "Sashtiabdapoorthi — Temple arch", note: "In review" },
];

export const TRANSLATIONS = [
  { lang: "Tamil", pct: 100 }, { lang: "English", pct: 100 }, { lang: "Telugu", pct: 68 },
  { lang: "Kannada", pct: 41 }, { lang: "Malayalam", pct: 24 }, { lang: "Hindi", pct: 12 },
];

export const LEGAL_ITEMS = [
  { id: "l1", title: "Terms of Service", note: "Updated Jun 2026" },
  { id: "l2", title: "Privacy Policy", note: "Updated Jun 2026" },
  { id: "l3", title: "Refund Policy", note: "Updated May 2026" },
];

export const PACKAGE_STYLE = {
  regular: { tint: C.sub, soft: "#F3F4F6" },
  pro: { tint: C.primary, soft: C.primarySoft },
  advanced: { tint: C.gold, soft: C.goldSoft },
};
