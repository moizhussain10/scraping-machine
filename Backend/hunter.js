import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs'

puppeteer.use(StealthPlugin());

const processedSerials = new Set();


async function verifyStatus(browser, lead, mainPage) {
    if (!lead.link) return false;

    let attempts = 0;
    const maxAttempts = 5;
    let detailPage;
    let context;
    let success = false;

    // --- 1. RETRY LOOP & ERROR HANDLING (As it was) ---
    while (attempts < maxAttempts) {
        try {
            context = await browser.createBrowserContext();
            detailPage = await context.newPage();
            await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            const response = await detailPage.goto(lead.link, { waitUntil: 'networkidle2', timeout: 45000 });
            const pageContent = await detailPage.content();

            // Check for 403 or Search Error
            const isBlocked = response.status() === 403 || pageContent.includes("403 Forbidden") || pageContent.includes("Access Denied");
            const isSearchError = pageContent.includes("The system was unable to perform your search");

            if (isBlocked || isSearchError) {
                const errorType = isBlocked ? "🚫 BLOCKED (403)" : "⚠️ SEARCH FAIL";
                process.stdout.write(`${errorType}! Resting 60s (Attempt ${attempts + 1})... `);

                await detailPage.close();
                await context.close();

                await new Promise(r => setTimeout(r, 20000));
                attempts++;
                continue;
            }

            // --- 2. STATUS CHECK ---
            await new Promise(r => setTimeout(r, 3000));

            const statusCheck = await detailPage.evaluate(() => {
                const bodyText = document.body.innerText;
                let mName = "Unknown";
                const nameMatch = bodyText.match(/Mark:\s*([^]*?)(?=\n|Status:)/i);
                if (nameMatch) {
                    mName = nameMatch[1].trim();
                } else {
                    const headerMark = document.querySelector('.mark-name, h1, h2');
                    if (headerMark) mName = headerMark.innerText.trim();
                }
                const isLive = bodyText.toLowerCase().includes("status: live") || bodyText.toLowerCase().includes("status: active");
                const keywords = ["office action", "statement of use", "section 8", "incomplete response"];
                return {
                    name: mName,
                    isLive: isLive,
                    hasKeyword: keywords.some(k => bodyText.toLowerCase().includes(k))
                };
            });

            lead.markName = statusCheck.name;

            if (statusCheck.isLive) {
                process.stdout.write(`✅ Current is LIVE... `);
                await context.close();
                return false;
            }

            if (!statusCheck.hasKeyword) {
                await context.close();
                return false;
            }

            // --- 3. DOCUMENTS TAB ---
            process.stdout.write(`📂 Documents Tab... `);
            await detailPage.evaluate(() => {
                const docBtn = document.querySelector('a[data-event-label="documentsTabBtn"]');
                if (docBtn) docBtn.click();
            });

            await new Promise(r => setTimeout(r, 5000));
            // --- Aapka Original Error Handling ---
            const docErrorFound = await detailPage.evaluate(() =>
                document.body.innerText.includes("The system was unable to perform your search" || "0 document(s) found")

            );

            if (docErrorFound) {
                process.stdout.write(`⚠️ DOC SEARCH FAIL! Retrying... `);
                await detailPage.close().catch(() => { });
                await context.close().catch(() => { });
                await new Promise(r => setTimeout(r, 20000));
                attempts++;
                continue;
            }

            await detailPage.waitForFunction(() => document.querySelector('.post-fnd-table') !== null, { timeout: 15000 }).catch(() => { });
            await new Promise(r => setTimeout(r, 4000));

            // --- 🚀 FIX: LINK RETRY LOGIC (Bina bypass chhere) ---
            let linkOpened = false;
            let linkAttempts = 0;

            while (linkAttempts < 3 && !linkOpened) {
                linkOpened = await detailPage.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    let target = links.find(l => l.innerText.trim() === "Application") ||
                        links.find(l => l.innerText.toLowerCase().endsWith("new application"));
                    if (target) {
                        target.setAttribute('target', '_self');
                        target.click();
                        return true;
                    }
                    return false;
                });

                if (!linkOpened) {
                    linkAttempts++;
                    if (linkAttempts < 3) {
                        process.stdout.write(`🔄 Link hidden, retrying (${linkAttempts})... `);
                        await new Promise(r => setTimeout(r, 20000)); // Thoda wait karke dubara dhoondega
                    }
                }
            }

            // Agar 3 koshish baad bhi link nahi mila, toh isay bhi error treat karke retry karein
            if (!linkOpened) {
                process.stdout.write(`⚠️ LINK NOT FOUND! Full Reset... `);
                await detailPage.close().catch(() => { });
                await context.close().catch(() => { });
                attempts++;
                continue;
            }

            // --- 4. DATA EXTRACTION ---
            let resultsArray = [];

            if (linkOpened) {
                process.stdout.write(`📄 Scanning Application Data... `);

                await detailPage.waitForFunction(() => {
                    return Array.from(window.frames).some(f => {
                        try { return f.document.body.innerText.includes("OWNER"); }
                        catch (e) { return false; }
                    });
                }, { timeout: 30000 }).catch(() => { });

                const frames = detailPage.frames();
                let targetFrame = null;
                let frameBlocked = false;

                for (const f of frames) {
                    try {
                        const content = await f.content();
                        if (content.includes("403 Forbidden")) { frameBlocked = true; break; }
                        if (content.includes("OWNER OF MARK") || content.includes("APPLICANT INFORMATION") || content.includes("*Name")) {
                            targetFrame = f; break;
                        }
                    } catch (e) { continue; }
                }

                if (frameBlocked) throw new Error("USPTO_VIEWER_403");

                if (targetFrame) {
                    resultsArray = await targetFrame.evaluate(async () => {
                        let results = [];
                        // TR aur DIV dono uthao sequence mein
                        const elements = Array.from(document.querySelectorAll('td, tr, div'));

                        const stopHeaders = [
                            "ATTORNEY INFORMATION",
                            "CORRESPONDENCE INFORMATION",
                            "DOMESTIC REPRESENTATIVE",
                            "FEE INFORMATION",
                            "SIGNATURE SECTION",
                            "DECLARATION AND SIGNATURE"
                        ];

                        const attorneyRef = ["ATTORNEY", "LAWYER", "REPRESENTATIVE", "COUNSEL", "LEGAL", "ESQ", "LAW FIRM"];
                        let currentOwner = null;
                        let stopScraping = false;

                        for (let el of elements) {
                            if (stopScraping) break;

                            let text = el.innerText.trim().toUpperCase();

                            // 🛡️ STEP 1: STRICT HEADER CHECK
                            // Sirf tab break karo jab DIV ke andar EXACTLY wahi text ho (no extra long text)
                            // Taake container divs loop ko na toden
                            if (el.tagName === 'DIV' && text.length < 50) {
                                if (stopHeaders.some(h => text === h)) {
                                    console.log("🛑 STOP HEADER DETECTED: " + text);
                                    stopScraping = true;
                                    break;
                                }
                            }

                            // 🎯 STEP 2: DATA EXTRACTION (Sirf TRs ke liye)
                            if (el.tagName === 'TR') {
                                const cells = Array.from(el.querySelectorAll('td, th'));
                                if (cells.length < 2) continue;

                                let label = cells[0].innerText.trim().toUpperCase();
                                let value = cells[1].innerText.trim();
                                let valueUpper = value.toUpperCase();

                                // --- Name Extraction (Using your exact labels) ---
                                if (label.includes("SIGNATORY'S NAME") || label.includes("*NAME") || label === "* SIGNATORY'S NAME") {
                                    const isLegalName = attorneyRef.some(k => valueUpper.includes(k));

                                    if (value && !isLegalName) {
                                        let cleanName = value.replace(/\//g, "").trim();
                                        currentOwner = { owner: cleanName, email: "N/A", phone: "N/A" };
                                        results.push(currentOwner);
                                    }
                                }

                                if (!currentOwner) continue;

                                // --- Entity Type Check ---
                                if (label.includes("ENTITY TYPE") || label.includes("LEGAL ENTITY TYPE")) {
                                    if (!valueUpper.includes("INDIVIDUAL")) {
                                        results = results.filter(r => r !== currentOwner);
                                        currentOwner = null;
                                        continue;
                                    }
                                }

                                // --- Position/Attorney Check ---
                                if (label.includes("POSITION") || label.includes("SIGNATORY'S POSITION")) {
                                    if (attorneyRef.some(k => valueUpper.includes(k))) {
                                        results = results.filter(r => r !== currentOwner);
                                        currentOwner = null;
                                        continue;
                                    }
                                }

                                // --- Email & Phone ---
                                if (label.includes("*EMAIL ADDRESS") || label.includes("PRIMARY EMAIL ADDRESS FOR CORRESPONDENCE")) {
                                    if (value.includes('@') && !value.includes('*')) {
                                        currentOwner.email = value;
                                    }
                                }

                                if (label.includes("SIGNATORY'S PHONE NUMBER") || label.includes("PRIMARY TELEPHONE NUMBER")) {
                                    let cleanPhone = value.replace(/\//g, "").trim();
                                    if (cleanPhone.length > 5 && currentOwner.phone === "N/A") {
                                        currentOwner.phone = cleanPhone;
                                    }
                                }
                            }
                        }

                        return results;
                    });

                    // --- 🚀 3. BACKEND EMIT LOGIC (Improved) ---
                    if (resultsArray.shouldSkip) {
                        process.stdout.write(`⏩ SKIP (Attorney/Entity) `);
                        success = false;
                    }
                    else if (Array.isArray(resultsArray) && resultsArray.length > 0) {

                        lead.owners = resultsArray;

                        let validLeadsFound = 0;

                        for (const res of resultsArray) {
                            // Agar Phone N/A hai, toh hum console mein print karenge taaki aapko pata chale
                            if (res.phone === "N/A" || res.phone === "") {
                                process.stdout.write(`| 😶 No Phone for ${res.owner} `);
                                continue;
                            }

                            process.stdout.write(`🎯 FOUND: ${res.owner} | 📞 ${res.phone} `);

                            // hunter.js mein jahan lead milti hai:
                            if (Array.isArray(resultsArray) && resultsArray.length > 0) {
                                for (const res of resultsArray) {
                                    if (res.phone !== "N/A") {
                                        // Socket emit ki jagah ye function call karo:
                                        global.addLead({
                                            markName: lead.markName,
                                            serial: lead.serial,
                                            owner: res.owner,
                                            email: res.email,
                                            phone: res.phone,
                                            status: "Dead"
                                        });
                                    }
                                }
                            }

                            // 🚀 --- CSV SAVING LOGIC START ---
                            const fileName = 'Scraped_Leads.csv';
                            // Agar file nahi bani, toh pehle headers likho
                            if (!fs.existsSync(fileName)) {
                                const headers = "Name,Number,Email,Trademark name,Serial,Status\n";
                                fs.writeFileSync(fileName, headers);
                            }

                            // Data format karo (Quotes use ki hain taake commas se column kharab na hon)
                            const row = `"${res.owner}","${res.phone}","${res.email}","${lead.markName}","${lead.serial}","Dead"\n`;

                            // File mein append karo
                            fs.appendFileSync(fileName, row);
                            // 🚀 --- CSV SAVING LOGIC END ---

                            validLeadsFound++
                        }

                        success = validLeadsFound > 0;
                        if (!success) process.stdout.write(`⚠️ Found owners but all had N/A Phone `);

                    } else {
                        // Agar resultsArray bilkul khali hai
                        process.stdout.write(`⚠️ No Owners Detected in Frame `);
                        success = false;
                    }

                    await detailPage.close().catch(() => { });
                    await context.close().catch(() => { });
                    break;
                }
            }


        } catch (e) {
            attempts++;
            process.stdout.write(`❌ Error: ${e.message} (Attempt ${attempts})... `);
            if (detailPage) try { await detailPage.close(); } catch (err) { }
            if (context) try { await context.close(); } catch (err) { }
            await new Promise(r => setTimeout(r, 15000));
        } finally {
            if (detailPage && !detailPage.isClosed()) try { await detailPage.close(); } catch (err) { }
            if (context) try { await context.close(); } catch (err) { }
        }
    }

    return success;
}

let isHunting = false; // Yeh lock hai

export const startHunting = async (query) => {

    if (isHunting) {
        console.log("⚠️ Bhai, pehle wala shikaar toh khatam hone do! (Already running)");
        return;
    }

    isHunting = true; // Lock laga do

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
    });

    const page = await browser.newPage();
    const allScrapedLeads = [];

    try {
        console.log(`🚀 Shikaar shuru: ${query}`);
        await page.goto('https://tmsearch.uspto.gov/search/search-results', {
            waitUntil: 'networkidle2', timeout: 80000
        });

        await new Promise(r => setTimeout(r, 5000));

        const injected = await page.evaluate((searchQuery) => {
            const allInputs = [...document.querySelectorAll('textarea, input')];
            const target = allInputs.find(el => {
                const attrs = (el.id + el.name + el.className + (el.getAttribute('aria-label') || "")).toLowerCase();
                return attrs.includes('query') || attrs.includes('search');
            });
            if (target) {
                target.value = searchQuery;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        }, query);

        await page.keyboard.press('Enter');

        let hasNextPage = true;
        let pageCount = 1;

        while (hasNextPage) {
            console.log(`⏳ Page ${pageCount} Scan ho raha hai...`);
            await new Promise(r => setTimeout(r, 15000));

            const resultsFrame = page.frames().find(f => f.url().includes('search-results'));
            if (!resultsFrame) continue;

            // --- IMPROVED EXTRACTION LOGIC (Dead only + Mark Name) ---
            const currentPageLeads = await resultsFrame.evaluate(() => {
                const results = [];
                const rows = Array.from(document.querySelectorAll('div[role="row"], tr, .result-card'));
                const seenSerials = new Set();

                rows.forEach(r => {
                    const text = r.innerText || "";
                    const upperText = text.toUpperCase();

                    // Filter: Individual; USA ho AUR "DEAD" likha ho (LIVE ko skip)
                    if (upperText.includes('INDIVIDUAL; USA') && upperText.includes('DEAD')) {
                        const serialMatch = text.match(/\b[789]\d{7}\b/);
                        if (serialMatch && !seenSerials.has(serialMatch[0])) {
                            const serial = serialMatch[0];
                            seenSerials.add(serial);

                            // Mark Name uthana (Aapke UI ke mutabiq 2nd ya 3rd column)
                            // Hum querySelector se link ka text le rahe hain jo aksar Mark Name hota hai
                            const markNameEl = r.querySelector('a');
                            const markName = markNameEl ? markNameEl.innerText.trim() : "Unknown";

                            let link = markNameEl?.href;
                            if (!link || link.includes('javascript:void')) {
                                link = `https://tsdr.uspto.gov/#caseNumber=${serial}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`;
                            }

                            results.push({ serial, link, markName });
                        }
                    }
                });
                return results;
            });

            if (currentPageLeads.length > 0) {
                console.log(`🚀 Page ${pageCount} par ${currentPageLeads.length} DEAD leads mil gayeen.`);

                for (const lead of currentPageLeads) {
                    // --- 2. DUPLICATE CHECK ---
                    if (processedSerials.has(lead.serial)) {
                        continue; // Agar ye serial pehle ho chuka hai toh skip karo
                    }

                    process.stdout.write(`⏳ Checking: ${lead.serial} (${lead.markName})... `);
                    const isPassed = await verifyStatus(browser, lead, resultsFrame);

                    if (isPassed) {
                        processedSerials.add(lead.serial); // Yaad rakho ke ye ho gayi
                        allScrapedLeads.push(lead);
                        process.stdout.write(`✅ PASS\n`);
                    } else {
                        // Skip wali ko bhi add kar sakte hain taake bar-bar koshish na kare
                        processedSerials.add(lead.serial);
                        process.stdout.write(`❌ SKIP\n`);
                    }
                }
            }

            console.log(`📊 Total Qualified Leads: ${allScrapedLeads.length}`);
            // Taake terminal mein poora JSON tree nazar aaye
            console.log(JSON.stringify(allScrapedLeads, null, 2));

            const nextClicked = await resultsFrame.evaluate(() => {
                const pageLinks = Array.from(document.querySelectorAll('a.page-link'));
                const nextBtn = pageLinks.find(link =>
                    link.querySelector('i.material-icons')?.innerText.trim() === 'navigate_next'
                );
                if (nextBtn && !nextBtn.parentElement.classList.contains('disabled')) {
                    nextBtn.click();
                    return true;
                }
                return false;
            }).catch(() => false);

            if (nextClicked) pageCount++;
            else hasNextPage = false;
        }

        console.log("🎯 Final Result:", allScrapedLeads);
        return allScrapedLeads;

    } catch (error) {
        console.error("⚠️ Error:", error.message);
    } finally {
        isHunting = false; // Yeh line lazmi yahan honi chahiye

        if (global.io) {
            global.io.emit('scanning-stopped');
        }

        console.log("🔓 Lock released. Ready for next search.");
    }
};