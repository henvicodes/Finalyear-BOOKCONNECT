import React, { useState, useEffect, useRef } from "react";
import { Search, Filter, ChevronDown, X, Sparkles, Loader, BookOpen, Users } from "lucide-react";

// ── Search Bar ────────────────────────────────────────────────────────────────
const GENRES  = ["Fiction","Non-Fiction","Science","Technology","History","Philosophy","Poetry","Romance"];
const RATINGS = ["4.5+","4.0+","3.5+","Any"];
const LANGS   = ["English","Hindi","Marathi","French","Spanish"];
const TYPES   = ["Free","Paid"];

const SearchBar = () => {
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState({ books:[], authors:[], aiSuggestions:[], intent:"" });
  const [aiRecs, setAiRecs]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [showDrop, setShowDrop]       = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState({ genre:"", rating:"", language:"", type:"" });
  const wrapRef = useRef(null);
  const timer   = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDrop(false); setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ books:[], authors:[], aiSuggestions:[], intent:"" });
      setAiRecs([]); setShowDrop(false); return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true); setShowDrop(true);
      try {
        const params = new URLSearchParams({ search: query });
        if (filters.genre)    params.append("genre",    filters.genre);
        if (filters.language) params.append("language", filters.language);
        if (filters.type)     params.append("isPaid",   filters.type==="Paid"?"true":"false");
        const token = JSON.parse(localStorage.getItem("user")||"{}").token;
        const [booksRes, usersRes] = await Promise.all([
          fetch(`/api/books?${params}`,{ headers:{ Authorization:`Bearer ${token}` }}).then(r=>r.json()).catch(()=>({data:[]})),
          fetch(`/api/auth/search?q=${query}`,{ headers:{ Authorization:`Bearer ${token}` }}).then(r=>r.json()).catch(()=>({data:[]})),
        ]);
        setResults(prev => ({
          ...prev,
          books:   booksRes.data?.slice(0,4) || [],
          authors: usersRes.data?.slice(0,3) || [],
        }));
      } catch(e) { console.error(e); }
      finally { setLoading(false); }

      setAiLoading(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514", max_tokens:600,
            messages:[{ role:"user", content:`You are a book search assistant for BookConnect.
User searched: "${query}". Filters: ${JSON.stringify(filters)}.
Reply ONLY valid JSON:
{"intent":"one sentence","suggestions":["s1","s2","s3"],"recommendations":[{"title":"T","author":"A","genre":"G","reason":"R"},{"title":"T","author":"A","genre":"G","reason":"R"},{"title":"T","author":"A","genre":"G","reason":"R"}]}`}]
          })
        });
        const data   = await res.json();
        const parsed = JSON.parse(data.content?.[0]?.text.replace(/```json|```/g,"").trim()||"{}");
        setResults(prev => ({ ...prev, aiSuggestions:parsed.suggestions||[], intent:parsed.intent||"" }));
        setAiRecs(parsed.recommendations||[]);
      } catch(e) { console.error(e); }
      finally { setAiLoading(false); }
    }, 500);
  }, [query, filters]);

  const toggleFilter = (key,val) => setFilters(prev=>({...prev,[key]:prev[key]===val?"":val}));
  const activeCount  = Object.values(filters).filter(Boolean).length;
  const hasResults   = results.books.length>0 || results.authors.length>0 || aiRecs.length>0;

  return (
    <div className="sb-wrap" ref={wrapRef}>
      <div className={`sb-box ${showDrop?"focused":""}`}>
        <Search size={15} className="sb-ico"/>
        <input
          className="sb-input"
          placeholder="Search books, authors, genres..."
          value={query}
          onChange={e=>setQuery(e.target.value)}
          onFocus={()=>query&&setShowDrop(true)}
        />
        {(loading||aiLoading) && <span className="sb-spin"/>}
        {query&&!loading&&!aiLoading && (
          <button className="sb-clear" onClick={()=>{setQuery("");setShowDrop(false);}}>
            <X size={13}/>
          </button>
        )}
        <div className="sb-divider"/>
        <button
          className={`sb-filter-btn ${showFilters?"active":""} ${activeCount?"has":""}`}
          onClick={()=>setShowFilters(p=>!p)}
        >
          <Filter size={12}/> Filters
          {activeCount>0 && <span className="sb-fcnt">{activeCount}</span>}
          <ChevronDown size={11} style={{transform:showFilters?"rotate(180deg)":"none",transition:".2s"}}/>
        </button>
      </div>

      {showFilters && (
        <div className="sb-filters">
          {[
            {label:"Genre",    key:"genre",    opts:GENRES },
            {label:"Rating",   key:"rating",   opts:RATINGS},
            {label:"Language", key:"language", opts:LANGS  },
            {label:"Type",     key:"type",     opts:TYPES  },
          ].map(({label,key,opts})=>(
            <div className="sb-fgroup" key={key}>
              <div className="sb-flbl">{label}</div>
              <div className="sb-chips">
                {opts.map(o=>(
                  <button key={o} className={`sb-chip ${filters[key]===o?"on":""}`} onClick={()=>toggleFilter(key,o)}>{o}</button>
                ))}
              </div>
            </div>
          ))}
          {activeCount>0 && (
            <button className="sb-clear-all" onClick={()=>setFilters({genre:"",rating:"",language:"",type:""})}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {showDrop && (
        <div className="sb-drop">
          {results.intent && (
            <div className="sb-intent"><Sparkles size={12}/><span>{results.intent}</span></div>
          )}
          {results.aiSuggestions?.length>0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><Sparkles size={11}/> AI suggestions</div>
              <div className="sb-sugrow">
                {results.aiSuggestions.map((s,i)=>(
                  <button key={i} className="sb-sugchip" onClick={()=>setQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {results.authors?.length>0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><Users size={11}/> Authors & Publishers</div>
              {results.authors.map((a,i)=>(
                <div key={i} className="sb-item">
                  <div className="sb-avatar">{a.name?.charAt(0).toUpperCase()}</div>
                  <div className="sb-info">
                    <div className="sb-ititle">{a.name}</div>
                    <div className="sb-isub">{a.role}</div>
                  </div>
                  <span className="sb-badge-a">{a.role}</span>
                </div>
              ))}
            </div>
          )}
          {results.books?.length>0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><BookOpen size={11}/> Books</div>
              {results.books.map((b,i)=>(
                <div key={i} className="sb-item">
                  <div className="sb-bookico"><BookOpen size={13}/></div>
                  <div className="sb-info">
                    <div className="sb-ititle">{b.title}</div>
                    <div className="sb-isub">by {b.author?.name||"Unknown"}{b.genre?` · ${b.genre}`:""}{b.isPaid?" · Paid":" · Free"}</div>
                  </div>
                  {b.averageRating>0 && <span className="sb-rating">⭐ {b.averageRating?.toFixed(1)}</span>}
                </div>
              ))}
            </div>
          )}
          {aiRecs?.length>0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><Sparkles size={11}/> AI recommended</div>
              {aiRecs.map((r,i)=>(
                <div key={i} className="sb-item">
                  <div className="sb-aiico"><Sparkles size={13}/></div>
                  <div className="sb-info">
                    <div className="sb-ititle">{r.title}</div>
                    <div className="sb-isub">by {r.author} · {r.genre}</div>
                    <div className="sb-reason">{r.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading&&!aiLoading&&!hasResults && (
            <div className="sb-empty">No results found for "{query}"</div>
          )}
          {(loading||aiLoading) && (
            <div className="sb-loading">
              <Loader size={14} className="sb-spin-icon"/>
              <span>{aiLoading?"AI is analyzing...":"Searching..."}</span>
            </div>
          )}
          <div className="sb-footer"><Search size={11}/> Search all results for "{query}"</div>
        </div>
      )}
    </div>
  );
};
export default SearchBar;