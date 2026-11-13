/* therajesh.shop — shared UI: Bengali language + dynamic colour theme */
(function () {
'use strict';
var LS = {get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }};



/* ---------------- Bengali ---------------- */
var BN = {
'Card shape': 'কার্ডের আকার',
'Fill 85.6×53.98 mm': 'ভরান ৮৫.৬×৫৩.৯৮ মিমি',
'Keep shape': 'অনুপাত রাখুন',
'Visit counter': 'ভিজিট কাউন্টার',
'To count visitors we log your IP address and approximate city. These logs are deleted after 90 days.': 'ভিজিটর গুনতে আমরা আপনার IP ঠিকানা ও আনুমানিক শহর লগ করি। এই লগ ৯০ দিন পর মুছে যায়।',
'PRINT': 'প্রিন্ট',
'SCAN': 'স্ক্যান',
'PASSPORT PHOTO': 'পাসপোর্ট ছবি',
'CARD CROP': 'কার্ড ক্রপ',
'PDF TOOLS': 'পিডিএফ টুলস',
'Printing': 'প্রিন্টিং',
'Photo Print': 'ফটো প্রিন্ট',
'Passport Photos': 'পাসপোর্ট ছবি',
'Scanning': 'স্ক্যানিং',
'Online Services': 'অনলাইন পরিষেবা',
'Waiting': 'অপেক্ষা',
'Printing…': 'প্রিন্ট হচ্ছে…',
'Done': 'সম্পন্ন',
'Paid': 'পেমেন্ট হয়েছে',
'Scanned': 'স্ক্যান হয়েছে',
'← Back': '← ফিরে যান',
'Take photo (Camera)': 'ছবি তুলুন (ক্যামেরা)',
'Choose from files': 'ফাইল থেকে বেছে নিন',
'Tap a card type above first.': 'আগে ওপর থেকে কার্ডের ধরন বাছুন।',
'Tap to upload front side': 'সামনের দিক আপলোড করতে ট্যাপ করুন',
'Tap to upload back side': 'পিছনের দিক আপলোড করতে ট্যাপ করুন',
'or drop an image here': 'অথবা এখানে ছবি ফেলুন',
'Select PDF files': 'PDF ফাইল বাছুন',
'Select PDF file': 'PDF ফাইল বাছুন',
'Select images': 'ছবি বাছুন',
'Select image': 'ছবি বাছুন',
'Select files': 'ফাইল বাছুন',
'or drop files here': 'অথবা এখানে ফাইল ফেলুন',
'Options': 'অপশন',
'+ Add more files': '+ আরও ফাইল যোগ করুন',
'Your file is ready!': 'আপনার ফাইল তৈরি!',
'It has been saved to your device. Nothing was uploaded.': 'ফাইলটি আপনার ডিভাইসে সেভ হয়েছে। কিছুই আপলোড হয়নি।',
'← Back to editing': '← এডিটে ফিরুন',
'Continue with this file': 'এই ফাইল নিয়ে এগিয়ে যান',
'Processing…': 'প্রসেস হচ্ছে…',
'Digital Seva Kendra · Instant Print Studio': 'ডিজিটাল সেবা কেন্দ্র · ইনস্ট্যান্ট প্রিন্ট স্টুডিও',
'How it works': 'কীভাবে কাজ করে',
'Scan QR. Upload. Pay. Print.': 'QR স্ক্যান করুন। আপলোড করুন। পেমেন্ট করুন। প্রিন্ট নিন।',
'Upload from your phone — collect a ready print at the counter.': 'ফোন থেকে আপলোড করুন — কাউন্টার থেকে তৈরি প্রিন্ট নিয়ে যান।',
'SCAN QR': 'QR স্ক্যান', 'UPLOAD & PAY': 'আপলোড ও পেমেন্ট', 'PRINT READY': 'প্রিন্ট তৈরি',
'Tools': 'টুলস', 'Documents & photos': 'ডকুমেন্ট ও ছবি', 'Passport photo': 'পাসপোর্ট ছবি', 'Card crop': 'কার্ড ক্রপ', 'Smart scanner': 'স্মার্ট স্ক্যানার', 'PDF tools': 'পিডিএফ টুলস',
'Protected PDF': 'সুরক্ষিত পিডিএফ',
'This PDF is password-protected. Enter its password to unlock it for printing.': 'এই পিডিএফে পাসওয়ার্ড দেওয়া আছে। প্রিন্টের জন্য খুলতে পাসওয়ার্ড লিখুন।',
'PDF password': 'পিডিএফ পাসওয়ার্ড', 'Enter PDF password': 'পিডিএফ পাসওয়ার্ড লিখুন',
'The password is used in this browser to prepare a printable copy. It is not added to your order or sent to the print server.': 'পাসওয়ার্ড শুধু এই ব্রাউজারে প্রিন্টযোগ্য কপি বানাতে ব্যবহার হয়। এটি অর্ডারে যোগ হয় না বা প্রিন্ট সার্ভারে যায় না।',
'Cancel file': 'ফাইল বাতিল', 'Unlock & Prepare': 'আনলক ও প্রস্তুত করুন',
'Preview': 'প্রিভিউ', '1 Page': '১ পৃষ্ঠা', 'Zoom Out': 'ছোট করুন', 'Zoom In': 'বড় করুন', 'Rotate 90°': '৯০° ঘোরান', '↻ Rotate': '↻ ঘোরান', '✕ Close': '✕ বন্ধ', 'Close': 'বন্ধ করুন',
'Crop photo': 'ছবি ক্রপ', 'Free crop': 'ফ্রি ক্রপ', 'Full image': 'পুরো ছবি',
'Drag on the photo to draw any crop box · drag corners/edges to resize · drag inside to move': 'ছবির ওপর টেনে ক্রপ বক্স আঁকুন · কোণা/ধার টেনে মাপ বদলান · ভেতরে টেনে সরান',
'Cancel': 'বাতিল', '✓ Apply crop': '✓ ক্রপ প্রয়োগ করুন',
'Print documents and photos': 'ডকুমেন্ট ও ছবি প্রিন্ট করুন',
'Upload your files, choose the paper and send them to the counter.': 'ফাইল আপলোড করুন, কাগজ বেছে নিন এবং কাউন্টারে পাঠান।',
'Upload documents or photos': 'ডকুমেন্ট বা ছবি আপলোড করুন',
'Drag and drop, or tap to browse. PDF, JPG, PNG, Word, Excel or PowerPoint, up to 10 files.': 'টেনে আনুন বা ট্যাপ করে বেছে নিন। PDF, JPG, PNG, Word, Excel বা PowerPoint, সর্বোচ্চ ১০টি ফাইল।',
'Paper size': 'কাগজের মাপ', '4×6 Photo': '৪×৬ ছবি', 'Print mode': 'প্রিন্টের ধরন', 'Color': 'রঙিন', 'Copies': 'কপি',
'Your name': 'আপনার নাম', 'Enter your name': 'আপনার নাম লিখুন', 'Mobile number (optional)': 'মোবাইল নম্বর (ঐচ্ছিক)', '10-digit mobile': '১০ অঙ্কের মোবাইল',
'pages ×': 'পৃষ্ঠা ×', 'copy': 'কপি', 'Send to counter': 'কাউন্টারে পাঠান',
'Passport photo sheet': 'পাসপোর্ট ছবির শিট',
'Upload one portrait. We fit as many photos as possible on a 4×6 or A4 sheet.': 'একটি ছবি আপলোড করুন। ৪×৬ বা A4 শিটে যত বেশি সম্ভব ছবি বসানো হবে।',
'Upload a portrait for the passport sheet': 'পাসপোর্ট শিটের জন্য ছবি আপলোড করুন',
'A clear front-facing photo (JPG, PNG or WebP). Background removal is built in.': 'সামনে থেকে তোলা পরিষ্কার ছবি (JPG, PNG বা WebP)। ব্যাকগ্রাউন্ড মোছার সুবিধা আছে।',
'Background colour': 'ব্যাকগ্রাউন্ডের রঙ', 'Keep original': 'আসল রাখুন', 'White': 'সাদা', 'Blue': 'নীল', 'Red': 'লাল', 'Grey': 'ধূসর', 'Custom colour': 'নিজের পছন্দের রঙ',
'Choose a colour to replace the background automatically.': 'ব্যাকগ্রাউন্ড বদলাতে একটি রঙ বেছে নিন।',
'Move and zoom to fit your face in the frame': 'মুখ ফ্রেমে বসাতে সরান ও জুম করুন',
'Sheet preview': 'শিটের প্রিভিউ', 'Photo size': 'ছবির মাপ', 'Custom': 'কাস্টম', 'Width': 'চওড়া', 'Height': 'উচ্চতা', 'Unit': 'একক', 'mm': 'মিমি', 'inch': 'ইঞ্চি', 'width × height': 'চওড়া × উচ্চতা',
'Print on': 'যেখানে প্রিন্ট', '4×6 Photo Paper': '৪×৬ ফটো পেপার', 'A4 Sheet': 'A4 শিট', 'How many photos?': 'কতগুলি ছবি?', '1 sheet': '১ শিট',
'Your order token': 'আপনার অর্ডার টোকেন', 'Opening secure payment…': 'নিরাপদ পেমেন্ট খুলছে…', 'Pay now': 'এখনই পেমেন্ট করুন',
'Pay online with any UPI app (QR shown in the payment window). Prefer cash? Show this token at the counter.': 'যেকোনো UPI অ্যাপে অনলাইন পেমেন্ট করুন (পেমেন্ট উইন্ডোতে QR দেখাবে)। নগদে দিতে চান? কাউন্টারে এই টোকেন দেখান।',
'Order progress': 'অর্ডারের অগ্রগতি', 'Upload': 'আপলোড', 'Pay': 'পেমেন্ট', 'Print': 'প্রিন্ট', 'Delete from PC': 'পিসি থেকে মুছুন', 'Delete from server': 'সার্ভার থেকে মুছুন',
'Waiting for counter approval…': 'কাউন্টারের অনুমোদনের অপেক্ষায়…',
'Printing starts automatically after your online payment is confirmed, or when the counter confirms cash.': 'অনলাইন পেমেন্ট নিশ্চিত হলে বা কাউন্টার নগদ নিশ্চিত করলে প্রিন্ট নিজে থেকেই শুরু হবে।',
'Start another order': 'নতুন অর্ডার শুরু করুন',
'Aadhaar, Ration, PAN, Voter, Ayushman, APAAR and ABHA cards cropped to PVC size.': 'আধার, রেশন, প্যান, ভোটার, আয়ুষ্মান, অ্যাপার ও আভা কার্ড PVC মাপে ক্রপ করুন।',
'Turn photos of documents or ID cards into clean A4 pages, then print or save as PDF.': 'ডকুমেন্ট বা আইডি কার্ডের ছবি পরিষ্কার A4 পৃষ্ঠায় বদলান, তারপর প্রিন্ট করুন বা PDF সেভ করুন।',
'Merge, split, compress, rotate, convert and more — done privately on your own device.': 'মার্জ, স্প্লিট, কমপ্রেস, ঘোরানো, কনভার্ট ও আরও — আপনার নিজের ডিভাইসেই, গোপনে।',
'Privacy by design': 'শুরু থেকেই গোপনীয়তা', 'We never keep your file': 'আমরা আপনার ফাইল কখনও রাখি না',
'Document is deleted the moment printing finishes — from the shop’s computer and from our server. Unpaid uploads expire in 60 minutes.': 'প্রিন্ট শেষ হওয়ামাত্র ডকুমেন্ট দোকানের কম্পিউটার ও আমাদের সার্ভার থেকে মুছে যায়। পেমেন্ট না হওয়া আপলোড ৬০ মিনিটে মেয়াদোত্তীর্ণ হয়।',
'Where your file goes': 'আপনার ফাইল কোথায় যায়',
'1 · PRINT ORDER — your file travels to the shop': '১ · প্রিন্ট অর্ডার — আপনার ফাইল দোকানে যায়',
'Your phone': 'আপনার ফোন', 'upload file': 'ফাইল আপলোড', 'Our server': 'আমাদের সার্ভার', 'held until paid': 'পেমেন্ট পর্যন্ত রাখা', 'Shop PC': 'দোকানের পিসি', 'temporary copy': 'সাময়িক কপি', 'Printer': 'প্রিন্টার', 'prints it': 'প্রিন্ট করে',
'HTTPS': 'HTTPS', 'after pay': 'পেমেন্টের পর', 'print': 'প্রিন্ট', 'Deleted after print': 'প্রিন্টের পর মোছা',
'2 · PDF TOOLS — your file never leaves your device': '২ · পিডিএফ টুলস — ফাইল আপনার ডিভাইস ছেড়ে যায় না',
'Your file': 'আপনার ফাইল', 'PDF or image': 'PDF বা ছবি', 'Your own browser': 'আপনার নিজের ব্রাউজার', 'merge · split · compress · convert all happen here': 'মার্জ · স্প্লিট · কমপ্রেস · কনভার্ট সব এখানেই হয়', 'Download': 'ডাউনলোড', 'result file': 'ফলাফল ফাইল',
'No upload · no server · no copy kept': 'আপলোড নেই · সার্ভার নেই · কপি রাখা হয় না',
'Deleted from the shop’s PC': 'দোকানের পিসি থেকে মোছা হয়',
'The temporary file is wiped from the shop computer as soon as the print comes out.': 'প্রিন্ট বের হওয়ামাত্র সাময়িক ফাইল দোকানের কম্পিউটার থেকে মুছে যায়।',
'Deleted from our server': 'আমাদের সার্ভার থেকে মোছা হয়',
'The same job is removed from our server right after. No copy is left behind.': 'এরপরই একই কাজ আমাদের সার্ভার থেকে সরানো হয়। কোনো কপি পড়ে থাকে না।',
'PDF tools stay on your device': 'পিডিএফ টুলস আপনার ডিভাইসেই থাকে',
'Merging, splitting and converting happen inside your browser. Those files are never uploaded.': 'মার্জ, স্প্লিট ও কনভার্ট আপনার ব্রাউজারের ভেতরেই হয়। এসব ফাইল কখনও আপলোড হয় না।',
'You can watch it happen': 'আপনি নিজে দেখতে পারেন',
'The customer’s tracker shows every step live — including both delete steps.': 'গ্রাহকের ট্র্যাকারে প্রতিটি ধাপ লাইভ দেখা যায় — দুটি মোছার ধাপসহ।',
'· Your files are deleted automatically right after printing.': '· প্রিন্টের পরই আপনার ফাইল নিজে থেকে মুছে যায়।',
'How we protect your files': 'আমরা কীভাবে আপনার ফাইল সুরক্ষিত রাখি',
'Visit our shop': 'আমাদের দোকানে আসুন', 'Digital Seva Kendra': 'ডিজিটাল সেবা কেন্দ্র',
'Printing · Photo Print · Passport Photos · Scanning · Online Services': 'প্রিন্টিং · ফটো প্রিন্ট · পাসপোর্ট ছবি · স্ক্যানিং · অনলাইন পরিষেবা',
'Get directions': 'রাস্তা দেখুন', 'Call 9932250689': 'ফোন করুন 9932250689', 'Developed by': 'তৈরি করেছেন', 'Rajesh Das': 'রাজেশ দাস',
'Aadhaar, Ration, PAN, Ayushman, Voter, APAAR, ABHA. Crops to PVC size (85.60 × 53.98 mm). Files are processed in your browser and never uploaded until you send an order.': 'আধার, রেশন, প্যান, আয়ুষ্মান, ভোটার, অ্যাপার, আভা। PVC মাপে (৮৫.৬০ × ৫৩.৯৮ মিমি) ক্রপ হয়। ফাইল ব্রাউজারেই প্রসেস হয়, অর্ডার না পাঠানো পর্যন্ত আপলোড হয় না।',
'Select file': 'ফাইল বাছুন', 'Enter password': 'পাসওয়ার্ড লিখুন',
'Drag a yellow box to move it. Drag its round handle to resize (card ratio stays locked). Use the arrows to nudge.': 'হলুদ বক্স টেনে সরান। গোল হ্যান্ডেল টেনে মাপ বদলান (কার্ডের অনুপাত ঠিক থাকে)। তীর দিয়ে সামান্য সরান।',
'Auto crop again': 'আবার অটো ক্রপ', 'Reset boxes': 'বক্স রিসেট', 'Nudge': 'সামান্য সরান', 'Left': 'বাঁয়ে', 'Right': 'ডানে', 'Down': 'নিচে', 'Smaller': 'ছোট', 'Larger': 'বড়', 'Resolution': 'রেজোলিউশন', 'Output': 'আউটপুট',
'Normal Aadhaar': 'সাধারণ আধার', 'Tricolour Aadhaar': 'তিরঙ্গা আধার', 'Brightness': 'উজ্জ্বলতা', 'Contrast': 'কনট্রাস্ট', 'Saturation': 'স্যাচুরেশন',
'Front': 'সামনে', 'Front JPG': 'সামনের JPG', 'Back': 'পিছনে', 'Back JPG': 'পিছনের JPG', 'Print or save': 'প্রিন্ট বা সেভ', 'Sheet': 'শিট', 'A4 (up to 5 pairs)': 'A4 (সর্বোচ্চ ৫ জোড়া)', '4×6 photo': '৪×৬ ছবি',
'Add to print order': 'প্রিন্ট অর্ডারে যোগ করুন', 'Save as PDF': 'PDF হিসেবে সেভ', 'Download both JPG': 'দুটি JPG ডাউনলোড', 'A4 sheet JPG': 'A4 শিট JPG', '4×6 sheet JPG': '৪×৬ শিট JPG',
'Add this card to A4 batch': 'এই কার্ড A4 ব্যাচে যোগ করুন', 'Clear batch': 'ব্যাচ মুছুন',
'A4 batch: up to 5 front and back pairs on one sheet. Add to print order and Save as PDF use the batch if it has cards, otherwise the card on screen.': 'A4 ব্যাচ: এক শিটে সর্বোচ্চ ৫ জোড়া (সামনে-পিছনে)। ব্যাচে কার্ড থাকলে "প্রিন্ট অর্ডারে যোগ" ও "PDF সেভ" ব্যাচ ব্যবহার করে, নইলে পর্দার কার্ড।',
'Turn photos of ID cards or documents into clean, print-ready pages. Crop, straighten, filter, then print or save as PDF. Images stay on your device.': 'আইডি কার্ড বা ডকুমেন্টের ছবিকে পরিষ্কার, প্রিন্টের উপযোগী পৃষ্ঠায় বদলান। ক্রপ, সোজা, ফিল্টার করে প্রিন্ট বা PDF সেভ করুন। ছবি আপনার ডিভাইসেই থাকে।',
'Document type': 'ডকুমেন্টের ধরন', 'ID card (front and back on one A4)': 'আইডি কার্ড (এক A4-এ সামনে ও পিছনে)', 'A4 document': 'A4 ডকুমেন্ট', 'Custom size': 'নিজের মাপ', 'Filter': 'ফিল্টার',
'Original': 'আসল', 'Enhanced contrast': 'বাড়ানো কনট্রাস্ট', 'Grayscale': 'ধূসর', 'Black and white': 'সাদা-কালো', 'Warm': 'উষ্ণ',
'Width (mm)': 'চওড়া (মিমি)', 'Height (mm)': 'উচ্চতা (মিমি)', 'Max size in KB': 'সর্বোচ্চ সাইজ (KB)', 'Optional': 'ঐচ্ছিক', 'Front or first page': 'সামনে বা প্রথম পৃষ্ঠা',
'Draw a crop box, drag corners to resize, drag inside to move.': 'ক্রপ বক্স আঁকুন, কোণা টেনে মাপ বদলান, ভেতরে টেনে সরান।',
'Auto crop': 'অটো ক্রপ', 'Straighten': 'সোজা করুন', 'Back or second page (optional)': 'পিছনে বা দ্বিতীয় পৃষ্ঠা (ঐচ্ছিক)',
'Generate print preview': 'প্রিন্ট প্রিভিউ তৈরি করুন', 'Print preview': 'প্রিন্ট প্রিভিউ',
'Check every page, then add it to your print order or save it.': 'প্রতিটি পৃষ্ঠা দেখে নিন, তারপর প্রিন্ট অর্ডারে যোগ করুন বা সেভ করুন।',
'Download JPG': 'JPG ডাউনলোড', 'Print order': 'প্রিন্ট অর্ডার', '0 pages': '০ পৃষ্ঠা',
'No pages yet. Crop a card or scan a document, then choose Add to print order.': 'এখনও কোনো পৃষ্ঠা নেই। কার্ড ক্রপ বা ডকুমেন্ট স্ক্যান করে "প্রিন্ট অর্ডারে যোগ করুন" বাছুন।',
'Save order as PDF': 'অর্ডার PDF হিসেবে সেভ', 'Clear order': 'অর্ডার মুছুন',
'Scan the QR or tap your UPI app, then type the exact amount shown above. Prefer cash? Show this token at the counter.': 'QR স্ক্যান করুন বা UPI অ্যাপ খুলুন, তারপর ওপরে দেখানো সঠিক অঙ্ক লিখুন। নগদে দিতে চান? কাউন্টারে এই টোকেন দেখান।',
'Try payment again': 'আবার পেমেন্ট করুন', 'Open in any UPI app': 'যেকোনো UPI অ্যাপে খুলুন',
'After paying, show the green success screen at the counter. Printing starts as soon as the counter confirms.': 'পেমেন্টের পর কাউন্টারে সফলতার স্ক্রিন দেখান। কাউন্টার নিশ্চিত করলেই প্রিন্ট শুরু হবে।',
'Files in an order are deleted automatically right after printing. · Developed by': 'অর্ডারের ফাইল প্রিন্টের পরই নিজে থেকে মুছে যায়। · তৈরি করেছেন',
'View print order': 'প্রিন্ট অর্ডার দেখুন', 'Password protected PDF': 'পাসওয়ার্ড দেওয়া পিডিএফ', 'Password / পাসওয়ার্ড': 'পাসওয়ার্ড', 'Show password': 'পাসওয়ার্ড দেখান', 'Unlock and crop': 'আনলক ও ক্রপ',
/* PDF tools page */
'PDF Tools': 'পিডিএফ টুলস',
'Merge, split, compress, rotate, convert and more. Everything runs on your own device.': 'মার্জ, স্প্লিট, কমপ্রেস, ঘোরানো, কনভার্ট ও আরও। সবকিছু আপনার নিজের ডিভাইসেই চলে।',
'Front & Back': 'সামনে ও পিছনে', 'Front only': 'শুধু সামনে', '2-page PDF': '২ পৃষ্ঠার PDF', 'Password PDF': 'পাসওয়ার্ড PDF', '⚡ Instant Auto-Crop': '⚡ ইনস্ট্যান্ট অটো-ক্রপ', 'Clear search': 'সার্চ মুছুন', 'Search all tools…': 'সব টুল খুঁজুন…', 'All': 'সব', 'Organize': 'সাজান', 'Optimize': 'অপটিমাইজ', 'Convert to PDF': 'PDF-এ কনভার্ট', 'Convert from PDF': 'PDF থেকে কনভার্ট', 'Edit & Sign': 'এডিট ও সই', 'Security': 'নিরাপত্তা', 'AI Tools': 'AI টুলস',
'Your PDFs never leave your device': 'আপনার পিডিএফ ডিভাইস ছেড়ে যায় না',
'All PDF tools run inside your browser. Nothing is uploaded to our server. Printing orders are different: those files are deleted right after printing.': 'সব পিডিএফ টুল আপনার ব্রাউজারের ভেতরে চলে। আমাদের সার্ভারে কিছু আপলোড হয় না। প্রিন্ট অর্ডার আলাদা: সেই ফাইল প্রিন্টের পরই মুছে ফেলা হয়।',
'Read how we protect your files': 'আমরা কীভাবে ফাইল সুরক্ষিত রাখি পড়ুন',
'Tools marked “Soon” need server-side software and are not available yet.': '“শীঘ্রই” লেখা টুলগুলোর জন্য সার্ভার সফটওয়্যার দরকার, এখনও পাওয়া যায় না।',
'Click to choose files': 'ফাইল বাছতে ক্লিক করুন', 'Click to choose a file': 'ফাইল বাছতে ক্লিক করুন', 'Process': 'প্রসেস করুন', 'Soon': 'শীঘ্রই',
'Merge PDF': 'পিডিএফ মার্জ', 'Split PDF': 'পিডিএফ স্প্লিট', 'Organize PDF': 'পিডিএফ সাজান', 'Rotate PDF': 'পিডিএফ ঘোরান', 'JPG to PDF': 'JPG থেকে PDF', 'Page numbers': 'পেজ নম্বর', 'Watermark': 'ওয়াটারমার্ক', 'Edit metadata': 'মেটাডেটা এডিট', 'Compress PDF': 'পিডিএফ কমপ্রেস', 'PDF to JPG': 'PDF থেকে JPG', 'Crop PDF': 'পিডিএফ ক্রপ', 'Repair PDF': 'পিডিএফ মেরামত', 'Edit PDF': 'পিডিএফ এডিট', 'Sign PDF': 'পিডিএফে সই', 'Redact PDF': 'পিডিএফ রিড্যাক্ট', 'Scan to PDF': 'স্ক্যান থেকে PDF', 'PDF Forms': 'পিডিএফ ফর্ম', 'HTML to PDF': 'HTML থেকে PDF', 'PDF to Markdown': 'PDF থেকে Markdown', 'PDF to Word': 'PDF থেকে Word', 'Compare PDF': 'পিডিএফ তুলনা', 'Unlock PDF': 'পিডিএফ আনলক', 'PDF to PowerPoint': 'PDF থেকে PowerPoint', 'PDF to Excel': 'PDF থেকে Excel', 'Word to PDF': 'Word থেকে PDF', 'Excel to PDF': 'Excel থেকে PDF', 'PowerPoint to PDF': 'PowerPoint থেকে PDF', 'Protect PDF': 'পিডিএফ সুরক্ষিত', 'PDF to PDF/A': 'PDF থেকে PDF/A',
'Combine PDFs in the order you want.': 'পছন্দের ক্রমে একাধিক PDF জুড়ুন।', 'Extract pages or ranges into a new PDF.': 'পৃষ্ঠা বা পরিসর আলাদা করে নতুন PDF বানান।', 'Delete or reorder pages.': 'পৃষ্ঠা মুছুন বা ক্রম বদলান।', 'Rotate all pages the way you need.': 'সব পৃষ্ঠা প্রয়োজনমতো ঘোরান।', 'Turn JPG or PNG images into one PDF.': 'JPG বা PNG ছবি এক PDF-এ বদলান।', 'Add page numbers to every page.': 'প্রতিটি পৃষ্ঠায় পেজ নম্বর যোগ করুন।', 'Stamp text diagonally over every page.': 'প্রতিটি পৃষ্ঠায় কোনাকুনি লেখা বসান।', 'Set the title and author of your PDF.': 'PDF-এর শিরোনাম ও লেখকের নাম দিন।', 'Shrink file size by re-encoding pages.': 'পৃষ্ঠা পুনরায় এনকোড করে ফাইলের সাইজ কমান।', 'Convert each page into a JPG.': 'প্রতিটি পৃষ্ঠা JPG-তে বদলান।', 'Trim margins from every page.': 'প্রতিটি পৃষ্ঠার মার্জিন ছাঁটুন।', 'Rebuild a damaged PDF (best effort).': 'নষ্ট PDF ঠিক করার চেষ্টা করুন।', 'Add text anywhere on a page.': 'পৃষ্ঠার যেকোনো জায়গায় লেখা যোগ করুন।', 'Draw your signature and place it on a page.': 'সই এঁকে পৃষ্ঠায় বসান।', 'Permanently black out an area (page is flattened to an image).': 'একটি অংশ স্থায়ীভাবে কালো করুন (পৃষ্ঠা ছবিতে পরিণত হয়)।', 'Capture pages with your camera into a PDF.': 'ক্যামেরায় পৃষ্ঠার ছবি তুলে PDF বানান।', 'Detect and fill form fields.': 'ফর্মের ঘর খুঁজে পূরণ করুন।', 'Paste HTML or text to make a PDF (text only).': 'HTML বা লেখা পেস্ট করে PDF বানান (শুধু লেখা)।', 'Extract text as a Markdown file.': 'লেখা বের করে Markdown ফাইল বানান।', 'Extract text into an editable Word file (layout not kept).': 'লেখা বের করে এডিটযোগ্য Word ফাইল বানান (লেআউট থাকে না)।', 'Show text differences between two PDFs.': 'দুটি PDF-এর লেখার পার্থক্য দেখুন।', 'Remove usage restrictions (cannot crack open passwords).': 'ব্যবহারের বিধিনিষেধ সরান (পাসওয়ার্ড ভাঙা যায় না)।', 'Each page becomes a slide (as an image).': 'প্রতিটি পৃষ্ঠা একটি স্লাইড হয় (ছবি হিসেবে)।', 'Extract text lines into spreadsheet rows (one sheet per page).': 'লেখার লাইন স্প্রেডশিটের সারিতে বদলান (প্রতি পৃষ্ঠায় এক শিট)।', 'Convert a .docx to PDF (text only, formatting simplified).': '.docx থেকে PDF (শুধু লেখা, ফরম্যাট সরল)।', 'Convert a spreadsheet to PDF (values as text rows).': 'স্প্রেডশিট থেকে PDF (মান লেখার সারি হিসেবে)।', 'Convert a .pptx to PDF (slide text only).': '.pptx থেকে PDF (শুধু স্লাইডের লেখা)।',
'Pages to extract (e.g. 1-3,5)': 'যে পৃষ্ঠাগুলো নেবেন (যেমন 1-3,5)', 'New page order (e.g. 3,1,2-4). Pages left out are deleted.': 'নতুন পৃষ্ঠার ক্রম (যেমন 3,1,2-4)। বাদ দেওয়া পৃষ্ঠা মুছে যাবে।', 'Rotation': 'ঘোরানো', 'Position': 'অবস্থান', 'Watermark text': 'ওয়াটারমার্কের লেখা', 'Title': 'শিরোনাম', 'Author': 'লেখক', 'Quality': 'মান', 'Margin to remove (% of page)': 'বাদ দেওয়া মার্জিন (পৃষ্ঠার %)', 'Text': 'লেখা', 'Page': 'পৃষ্ঠা', 'Page number': 'পৃষ্ঠা নম্বর', 'Size': 'মাপ', 'Draw your signature': 'আপনার সই আঁকুন', 'Clear': 'মুছুন', 'HTML or text': 'HTML বা লেখা', 'Target language': 'যে ভাষায়'
};
Object.assign(BN, {
'Scan QR': 'QR স্ক্যান', 'Upload & Pay': 'আপলোড ও পেমেন্ট', 'Print Ready': 'প্রিন্ট প্রস্তুত',
'Privacy & Security Info': 'গোপনীয়তা ও নিরাপত্তা তথ্য', 'Privacy & Security': 'গোপনীয়তা ও নিরাপত্তা',
'Directions': 'দিকনির্দেশ', 'Call': 'কল করুন', 'Step': 'ধাপ', 'of': '/',
'Preview & edit': 'প্রিভিউ ও এডিট',
'Check your files. Preview, crop photos, pick pages, or remove a file.': 'আপনার ফাইল দেখে নিন। প্রিভিউ করুন, ছবি ক্রপ করুন, পৃষ্ঠা বেছে নিন বা ফাইল সরান।',
'Add more files': 'আরও ফাইল যোগ করুন', 'Print settings': 'প্রিন্ট সেটিংস',
'Continue →': 'এগিয়ে যান →', '← Back': '← পেছনে', 'Continue your order →': 'আপনার অর্ডার চালিয়ে যান →',
'Continue passport photo →': 'পাসপোর্ট ছবি চালিয়ে যান →', 'Continue crop & preview →': 'ক্রপ ও প্রিভিউ চালিয়ে যান →',
'Order token & payment': 'অর্ডার টোকেন ও পেমেন্ট', 'Order & payment': 'অর্ডার ও পেমেন্ট', 'Order placed': 'অর্ডার সম্পন্ন',
'Check the summary below, then tap Send. Secure payment opens next.': 'নিচের সারাংশ দেখে "পাঠান" চাপুন। এরপর নিরাপদ পেমেন্ট খুলবে।',
'Files': 'ফাইল', 'Paper': 'কাগজ', 'Mode': 'মোড', 'Name': 'নাম',
'Crop & background': 'ক্রপ ও ব্যাকগ্রাউন্ড',
'Move and zoom to fit your face in the frame, then pick a background.': 'ফ্রেমে মুখ বসাতে সরান ও জুম করুন, তারপর ব্যাকগ্রাউন্ড বেছে নিন।',
'Zoom': 'জুম', 'Transparent': 'স্বচ্ছ', 'White': 'সাদা', 'Blue': 'নীল', 'Red': 'লাল', 'Grey': 'ধূসর', 'Green': 'সবুজ', 'Custom': 'কাস্টম',
'Change photo': 'ছবি বদলান', 'Sheet preview & size': 'শিট প্রিভিউ ও সাইজ', 'Sheet & size': 'শিট ও সাইজ',
'Details & pay': 'বিবরণ ও পেমেন্ট', 'Your sheet price:': 'আপনার শিটের মূল্য:', 'Upload a portrait': 'একটি পোর্ট্রেট আপলোড করুন',
'Clear front-facing photo (JPG, PNG or WebP). Background removal is built in.': 'সামনে-মুখ স্পষ্ট ছবি (JPG, PNG বা WebP)। ব্যাকগ্রাউন্ড সরানো বিল্ট-ইন।',
'PDF, JPG, PNG, Word, Excel or PowerPoint · up to 10 files': 'PDF, JPG, PNG, Word, Excel বা PowerPoint · সর্বোচ্চ 10টি ফাইল',
'Front Side': 'সামনের দিক', 'Back Side': 'পেছনের দিক',
'Detect & adjust': 'শনাক্ত ও ঠিক করুন', 'Preview & download': 'প্রিভিউ ও ডাউনলোড', 'Next: preview →': 'পরবর্তী: প্রিভিউ →',
'Cropped card preview': 'ক্রপ করা কার্ডের প্রিভিউ',
'Tap Download to save your file. Nothing was uploaded.': 'ফাইল সেভ করতে ডাউনলোড চাপুন। কিছুই আপলোড হয়নি।',
'Download all': 'সব ডাউনলোড করুন'
});
Object.assign(BN, {
/* PDF tools v2: print hand-off, navigation, new tools */
'← Back to All PDF Tools': '← সব পিডিএফ টুলস-এ ফিরে যান',
'← Back to Edit / Modify': '← এডিট / পরিবর্তনে ফিরুন',
'🔄 Process Another File': '🔄 আরেকটি ফাইল প্রসেস করুন',
'🏠 All PDF Tools': '🏠 সব পিডিএফ টুলস',
'🖨️ Send to Counter (Print)': '🖨️ কাউন্টারে পাঠান (প্রিন্ট)',
'Sending to counter…': 'কাউন্টারে পাঠানো হচ্ছে…',
'⬇️ Download PDF': '⬇️ ডাউনলোড করুন',
'⬇️ Download File': '⬇️ ফাইল ডাউনলোড করুন',
'⬇️ Download JPG': '⬇️ JPG ডাউনলোড করুন',
'⬇️ Download Unlocked PDF': '⬇️ আনলক করা PDF ডাউনলোড করুন',
'⬇️ Download All (ZIP)': '⬇️ সব ডাউনলোড করুন (ZIP)',
'Nothing was uploaded. Your file is saved only when you tap a button below.': 'কিছুই আপলোড হয়নি। নিচের বোতামে চাপ দিলেই শুধু ফাইল সেভ হবে।',
'Original size': 'আসল সাইজ',
'New size': 'নতুন সাইজ',
'Saved': 'সাশ্রয়',
'The new file is not smaller than the original. Try Low / Fast Print, or keep the original.': 'নতুন ফাইল আসলের চেয়ে ছোট হয়নি। “Low / Fast Print” চেষ্টা করুন, অথবা আসল ফাইলটি রাখুন।',
'This file is over 25 MB. Compress it first, or download it.': 'ফাইলটি ২৫ MB-এর বেশি। আগে কমপ্রেস করুন, অথবা ডাউনলোড করুন।',
'Could not send the file to the print page. Please download it and upload it there.': 'ফাইলটি প্রিন্ট পেজে পাঠানো যায়নি। ডাউনলোড করে সেখানে আপলোড করুন।',
'Add at least 2 PDF files.': 'কমপক্ষে ২টি PDF ফাইল যোগ করুন।',
'Select at least one page.': 'কমপক্ষে একটি পৃষ্ঠা বাছুন।',
'Keep at least one page.': 'কমপক্ষে একটি পৃষ্ঠা রাখুন।',
'Rotate at least one page first.': 'আগে অন্তত একটি পৃষ্ঠা ঘোরান।',
'This PDF is password-protected. Use Unlock PDF first.': 'এই PDF-এ পাসওয়ার্ড দেওয়া আছে। আগে “Unlock PDF” ব্যবহার করুন।',
'Wrong password. Please try again.': 'পাসওয়ার্ড ভুল। আবার চেষ্টা করুন।',
'This PDF needs a password. Enter it above.': 'এই PDF-এর পাসওয়ার্ড লাগবে। ওপরে লিখুন।',
'No valid pages': 'কোনো সঠিক পৃষ্ঠা নেই',
'Choose two PDFs': 'দুটি PDF বাছুন',
'This file type is not supported for this tool.': 'এই টুলে এই ধরনের ফাইল চলে না।',
'Error:': 'ত্রুটি:',
'Could not read this PDF.': 'এই PDF পড়া যায়নি।',
'Loading…': 'লোড হচ্ছে…',
'No preview available for this file type.': 'এই ধরনের ফাইলের প্রিভিউ নেই।',
'Split / Extract Pages': 'পিডিএফ স্প্লিট / পৃষ্ঠা আলাদা',
'Tap the pages you want and extract them.': 'পছন্দের পৃষ্ঠায় ট্যাপ করে আলাদা করুন।',
'Organize & Delete Pages': 'পৃষ্ঠা সাজান ও মুছুন',
'Delete, rotate and reorder pages visually.': 'ছবি দেখে পৃষ্ঠা মুছুন, ঘোরান ও ক্রম বদলান।',
'Rotate pages and preview before saving.': 'পৃষ্ঠা ঘোরান এবং সেভের আগে প্রিভিউ দেখুন।',
'N-Up (2-in-1 / 4-in-1)': 'এক পাতায় ২টি / ৪টি পৃষ্ঠা',
'Put 2 or 4 pages on one A4 sheet. Saves paper.': 'এক A4 পাতায় ২টি বা ৪টি পৃষ্ঠা বসান। কাগজ বাঁচে।',
'PDF to Black & White': 'PDF সাদা-কালো করুন',
'Preview and print in grayscale for cheaper printing.': 'প্রিভিউ দেখে সস্তায় সাদা-কালো প্রিন্ট করুন।',
'Page Numbers & Header/Footer': 'পেজ নম্বর ও হেডার/ফুটার',
'Add Page 1 of X, plus optional header or footer text.': '“Page 1 of X” এবং ইচ্ছেমতো হেডার/ফুটার লেখা যোগ করুন।',
'Enter the password once and remove it (Aadhaar, PAN, bank PDFs).': 'একবার পাসওয়ার্ড দিয়ে সরিয়ে ফেলুন (আধার, প্যান, ব্যাংক PDF)।',
'🖨️ Print Shop': '🖨️ প্রিন্ট শপ',
'🖨️ Print-ready': '🖨️ প্রিন্টের জন্য তৈরি',
'NEW': 'নতুন',
'One PDF with the selected pages': 'বাছা পৃষ্ঠা নিয়ে একটি PDF',
'Separate PDF for each page': 'প্রতি পৃষ্ঠার জন্য আলাদা PDF',
'Page size': 'পৃষ্ঠার মাপ',
'A4 Fit': 'A4 ফিট',
'A4 with Margins': 'মার্জিনসহ A4',
'Original Size': 'আসল মাপ',
'Orientation': 'ওরিয়েন্টেশন',
'Portrait': 'পোর্ট্রেট (লম্বা)',
'Landscape': 'ল্যান্ডস্কেপ (চওড়া)',
'Auto (match each photo)': 'অটো (প্রতিটি ছবি অনুযায়ী)',
'300 DPI (high-res)': '৩০০ DPI (হাই-রেজ)',
'200 DPI (balanced)': '২০০ DPI (মাঝারি)',
'150 DPI (small files)': '১৫০ DPI (ছোট ফাইল)',
'Pages (leave empty for all)': 'পৃষ্ঠা (সব হলে ফাঁকা রাখুন)',
'e.g. 1-3, 5': 'যেমন 1-3, 5',
'Best': 'সেরা',
'High': 'উচ্চ',
'Low / Fast Print (smallest)': 'লো / ফাস্ট প্রিন্ট (সবচেয়ে ছোট)',
'Medium / Recommended': 'মিডিয়াম / প্রস্তাবিত',
'High Quality': 'হাই কোয়ালিটি',
'Pages become images, so text will no longer be selectable.': 'পৃষ্ঠাগুলো ছবি হয়ে যায়, তাই লেখা আর সিলেক্ট করা যাবে না।',
'Pages per sheet': 'প্রতি শিটে পৃষ্ঠা',
'2 pages per sheet': 'প্রতি শিটে ২টি পৃষ্ঠা',
'4 pages per sheet': 'প্রতি শিটে ৪টি পৃষ্ঠা',
'Sheet orientation': 'শিটের ওরিয়েন্টেশন',
'Draw border lines': 'বর্ডার লাইন আঁকুন',
'Style': 'স্টাইল',
'Grayscale (smooth)': 'গ্রেস্কেল (মসৃণ)',
'Pure black & white (sharp text)': 'খাঁটি সাদা-কালো (স্পষ্ট লেখা)',
'Standard (recommended)': 'স্ট্যান্ডার্ড (প্রস্তাবিত)',
'Number style': 'নম্বরের ধরন',
'Page 1 of X': 'Page 1 of X',
'1 / X': '1 / X',
'No page number': 'পেজ নম্বর নয়',
'Header text (optional)': 'হেডার লেখা (ঐচ্ছিক)',
'Footer text (optional)': 'ফুটার লেখা (ঐচ্ছিক)',
'Header': 'হেডার',
'Footer': 'ফুটার',
'Bottom center': 'নিচে মাঝখানে',
'Bottom right': 'নিচে ডানে',
'Bottom left': 'নিচে বাঁয়ে',
'Black': 'কালো',
'Opacity': 'স্বচ্ছতা',
'🔓 No password needed to open this file. It will be saved without restrictions.': '🔓 এই ফাইল খুলতে পাসওয়ার্ড লাগে না। এটি বিধিনিষেধ ছাড়া সেভ হবে।',
'🔒 This PDF is password-protected. Enter the password below.': '🔒 এই PDF-এ পাসওয়ার্ড আছে। নিচে পাসওয়ার্ড লিখুন।',
'PDF password (leave empty if none)': 'PDF পাসওয়ার্ড (না থাকলে ফাঁকা রাখুন)',
'The password is used only in this browser. It is not saved or sent anywhere. The unlocked copy keeps the page look but text may not be selectable.': 'পাসওয়ার্ড শুধু এই ব্রাউজারে ব্যবহার হয়; কোথাও সেভ বা পাঠানো হয় না। আনলক করা কপিতে পৃষ্ঠার চেহারা একই থাকে, তবে লেখা সিলেক্ট নাও করা যেতে পারে।',
'🔒 Password protected': '🔒 পাসওয়ার্ড দেওয়া',
'Select all': 'সব বাছুন',
'All Odd Pages': 'সব বিজোড় পৃষ্ঠা',
'All Even Pages': 'সব জোড় পৃষ্ঠা',
'Custom range e.g. 1-3, 5': 'নিজের পরিসর, যেমন 1-3, 5',
'Select': 'বাছুন',
'Restore all pages': 'সব পৃষ্ঠা ফিরিয়ে আনুন',
'Reverse order': 'ক্রম উল্টে দিন',
'Rotate all ↻': 'সব ঘোরান ↻',
'Rotate all ↺': 'সব ঘোরান ↺',
'Reset': 'রিসেট',
'pages selected': 'পৃষ্ঠা বাছা হয়েছে',
'pages kept': 'পৃষ্ঠা রাখা হচ্ছে',
'page': 'পৃষ্ঠা',
'pages': 'পৃষ্ঠা',
'file': 'ফাইল',
'files': 'ফাইল',
'Tap pages to select them.': 'পৃষ্ঠায় ট্যাপ করে বাছুন।',
'Tap a page to delete it. Use ◀ ▶ to move and ↻ to rotate.': 'মুছতে পৃষ্ঠায় ট্যাপ করুন। সরাতে ◀ ▶ এবং ঘোরাতে ↻ চাপুন।',
'Tap a page to rotate it.': 'ঘোরাতে পৃষ্ঠায় ট্যাপ করুন।',
'Live preview of page 1': '১ নম্বর পৃষ্ঠার লাইভ প্রিভিউ',
'Black & white preview': 'সাদা-কালো প্রিভিউ',
'This is how page 1 will look when printed in black & white.': 'সাদা-কালো প্রিন্টে ১ নম্বর পৃষ্ঠা এইরকম দেখাবে।',
'Remove': 'সরান',
'Move earlier': 'আগে সরান',
'Move later': 'পরে সরান',
'Rotate': 'ঘোরান',
'Rotate left': 'বাঁয়ে ঘোরান',
'Rotate right': 'ডানে ঘোরান',
'📁 Select PDF Files': '📁 পিডিএফ ফাইল সিলেক্ট করুন',
'📁 Select Images': '📁 ছবি সিলেক্ট করুন',
'📁 Select Image': '📁 ছবি সিলেক্ট করুন',
'📁 Select File': '📁 ফাইল সিলেক্ট করুন',
'✨ Multiple Files Supported': '✨ একসাথে একাধিক ফাইল',
'🔒 100% Private': '🔒 ১০০% প্রাইভেট',
'🖨️ Direct Counter Print': '🖨️ সরাসরি কাউন্টারে প্রিন্ট',
'How this tool works': 'এই টুল কীভাবে কাজ করে',
'1. Select Files': '১. ফাইল সিলেক্ট করুন',
'2. Customize': '২. কাস্টমাইজ করুন',
'3. Download or Send to Counter 🖨️': '৩. ডাউনলোড বা কাউন্টারে পাঠান 🖨️',
'2-in-1 A4 Layout': '২-ইন-১ A4 লেআউট',
'4-in-1 A4 Layout': '৪-ইন-১ A4 লেআউট',
'2 pages on 1 sheet': '১ শিটে ২টি পৃষ্ঠা',
'4 pages in a 2×2 grid': '২×২ গ্রিডে ৪টি পৃষ্ঠা',
'Page Border ON': 'পেজ বর্ডার চালু',
'Page Border OFF': 'পেজ বর্ডার বন্ধ',
'➕ Add More Files': '➕ আরও ফাইল যোগ করুন',
'🔍 Tap to Preview': '🔍 প্রিভিউ দেখতে ট্যাপ করুন',
'Combining files…': 'ফাইল একত্র করা হচ্ছে…',
'Add several PDFs, then drag them or use ◀ ▶ to set the order.': 'কয়েকটি PDF যোগ করুন, তারপর টেনে বা ◀ ▶ দিয়ে ক্রম ঠিক করুন।',
'Tap page thumbnails to pick pages, or type a range like 1-3, 5.': 'পৃষ্ঠার ছবিতে ট্যাপ করে বাছুন, অথবা 1-3, 5 এর মতো পরিসর লিখুন।',
'Delete, rotate and reorder pages before printing.': 'প্রিন্টের আগে পৃষ্ঠা মুছুন, ঘোরান ও ক্রম বদলান।',
'Tap a page to rotate it, or rotate all pages at once.': 'ঘোরাতে পৃষ্ঠায় ট্যাপ করুন, অথবা সব পৃষ্ঠা একসাথে ঘোরান।',
'Add photos, arrange them, then pick A4 size and orientation.': 'ছবি যোগ করুন, সাজান, তারপর A4 মাপ ও ওরিয়েন্টেশন বাছুন।',
'Every page becomes a sharp JPG. Download one page or all as a ZIP.': 'প্রতিটি পৃষ্ঠা স্পষ্ট JPG হয়ে যাবে। একটি বা সব ZIP করে ডাউনলোড করুন।',
'Pick a quality level. We show how much space you save.': 'মান বেছে নিন। কতটা জায়গা বাঁচল তা আমরা দেখাব।',
'See exactly how your page looks in black & white before printing.': 'প্রিন্টের আগে সাদা-কালোতে পৃষ্ঠাটি ঠিক কেমন দেখাবে তা দেখুন।',
'Add Page 1 of X, plus optional header and footer text.': '“Page 1 of X” এবং ইচ্ছেমতো হেডার ও ফুটার লেখা যোগ করুন।',
'Type your text and watch it appear on page 1 live.': 'লেখা টাইপ করুন, ১ নম্বর পৃষ্ঠায় লাইভ দেখুন।',
'Enter the password once and get an unlocked copy, ready to print.': 'একবার পাসওয়ার্ড দিন, প্রিন্টের জন্য তৈরি আনলক করা কপি পান।',
'Put 2 or 4 pages on each A4 sheet to save paper and money.': 'প্রতি A4 শিটে ২ বা ৪টি পৃষ্ঠা বসিয়ে কাগজ ও টাকা বাঁচান।',
'Choose a strong password. The PDF will ask for it every time it is opened.': 'একটি শক্ত পাসওয়ার্ড দিন। PDF খুললেই প্রতিবার এটি চাইবে।',
'Adds PDF/A metadata and an sRGB colour profile. Flattening gives the most reliable printing.': 'PDF/A মেটাডেটা ও sRGB কালার প্রোফাইল যোগ করে। ফ্ল্যাটেন করলে প্রিন্ট সবচেয়ে নির্ভরযোগ্য হয়।',
'Lock your PDF with a strong password to prevent unauthorized opening.': 'পাসওয়ার্ড দিয়ে আপনার পিডিএফ লক ও সুরক্ষিত করুন।',
'Convert PDF to ISO-standardized PDF/A format for long-term archiving & error-free printing.': 'দীর্ঘমেয়াদী সংরক্ষণ ও নির্ভুল প্রিন্টের জন্য PDF/A ফরম্যাটে রূপান্তর করুন।',
'🔒 Password Lock': '🔒 পাসওয়ার্ড লক',
'ISO Standard': 'ISO স্ট্যান্ডার্ড',
'⬇️ Download Protected PDF': '⬇️ সুরক্ষিত PDF ডাউনলোড করুন',
'⬇️ Download PDF/A': '⬇️ PDF/A ডাউনলোড করুন',
'Confirm password': 'পাসওয়ার্ড নিশ্চিত করুন',
'👁️ Show': '👁️ দেখান',
'🙈 Hide': '🙈 লুকান',
'Permissions': 'অনুমতি',
'Allow Printing': 'প্রিন্ট করার অনুমতি',
'Allow Copying Text': 'লেখা কপি করার অনুমতি',
'AES-128 encryption is applied in your browser. Remember the password: it cannot be recovered. Use letters, numbers and symbols only.': 'AES-128 এনক্রিপশন আপনার ব্রাউজারেই হয়। পাসওয়ার্ড মনে রাখুন — এটি ফিরে পাওয়া যায় না। শুধু অক্ষর, সংখ্যা ও চিহ্ন ব্যবহার করুন।',
'Password must be at least 4 characters.': 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।',
'Use letters, numbers and symbols only in the password.': 'পাসওয়ার্ডে শুধু অক্ষর, সংখ্যা ও চিহ্ন ব্যবহার করুন।',
'Passwords do not match.': 'পাসওয়ার্ড দুটি মেলেনি।',
'Conformance level': 'কনফর্ম্যান্স লেভেল',
'PDF/A-1b (Basic Visual Preservation - Recommended)': 'PDF/A-1b (মৌলিক ভিজ্যুয়াল সংরক্ষণ - প্রস্তাবিত)',
'PDF/A-2b': 'PDF/A-2b',
'Flatten pages for 100% Print Compatibility': '১০০% প্রিন্ট সামঞ্জস্যের জন্য পৃষ্ঠা ফ্ল্যাটেন করুন',
'Flatten renders every page at 300 DPI, so fonts can never break at the print counter. Text will not be selectable and the file gets larger. Please validate with veraPDF if you need certified archival compliance.': 'ফ্ল্যাটেন করলে প্রতিটি পৃষ্ঠা ৩০০ DPI-তে ছবি হয়, তাই প্রিন্ট কাউন্টারে ফন্ট নষ্ট হয় না। লেখা সিলেক্ট করা যাবে না এবং ফাইল বড় হবে। সনদযুক্ত আর্কাইভ মান দরকার হলে veraPDF দিয়ে যাচাই করুন।',
'Previous page': 'আগের পৃষ্ঠা',
'Next page': 'পরের পৃষ্ঠা',
'Zoom out': 'জুম কমান',
'Zoom in': 'জুম বাড়ান',
'Reset zoom': 'জুম রিসেট',
'Show or hide password': 'পাসওয়ার্ড দেখান বা লুকান'
});
/* Bengali digits for pure numbers are left as-is on purpose (prices, counts). */

var lang = LS.get('site-lang') === 'bn' ? 'bn' : 'en';
var origText = new WeakMap(), busy = false;
var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
function trNode(n) {
  var o = origText.has(n) ? origText.get(n) : n.nodeValue, key = norm(o);
  if (lang === 'bn' && BN[key]) {
    if (!origText.has(n)) origText.set(n, o);
    var lead = /^\s*/.exec(o)[0], trail = /\s*$/.exec(o)[0], v = lead + BN[key] + trail;
    if (n.nodeValue !== v) n.nodeValue = v;
  } else if (lang === 'en' && origText.has(n)) { n.nodeValue = origText.get(n); origText.delete(n); }
  else if (lang === 'bn' && origText.has(n) && n.nodeValue !== o && !BN[norm(n.nodeValue)]) origText.delete(n);
}
function trEl(el) {
  ATTRS.forEach(function (a) {
    if (!el.hasAttribute || !el.hasAttribute(a)) return;
    var k = 'data-o-' + a, cur = el.getAttribute(a), o = el.hasAttribute(k) ? el.getAttribute(k) : cur;
    if (lang === 'bn' && BN[norm(o)]) { el.setAttribute(k, o); el.setAttribute(a, BN[norm(o)]); }
    else if (lang === 'en' && el.hasAttribute(k)) { el.setAttribute(a, el.getAttribute(k)); el.removeAttribute(k); }
  });
}
function walk(root) {
  if (!root) return;
  busy = true;
  try {
    if (root.nodeType === 3) { trNode(root); return; }
    if (root.nodeType !== 1) return;
    trEl(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(n.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = tw.nextNode())) { if (n.nodeType === 3) trNode(n); else trEl(n); }
  } finally { busy = false; }
}
/* elements with data-en / data-bn (leaf text) switch language here, so it works on every page without extra scripts */
function dataLang(root) {
  var n = (root || document).querySelectorAll('[data-en][data-bn]');
  for (var i = 0; i < n.length; i++) { var t = n[i].getAttribute('data-' + lang); if (t != null && n[i].textContent !== t) n[i].textContent = t; }
}
function setLang(l) {
  lang = l; LS.set('site-lang', l);
  document.documentElement.lang = l === 'bn' ? 'bn' : 'en';
  syncUI();
  requestAnimationFrame(function () { walk(document.body); dataLang(); });
}
var mo = new MutationObserver(function (ms) {
  if (busy) return;
  ms.forEach(function (m) {
    if (m.type === 'childList') m.addedNodes.forEach(function (n) { if (!(n.closest && n.closest('.sui')) && !(n.nodeType===1&&n.className==='sui')) { walk(n); if (n.nodeType === 1) reveal(n); } });
    else if (m.type === 'characterData') { busy = true; try { trNode(m.target); } finally { busy = false; } }
      });
});

/* ---------------- language bar (very top of every page) ---------------- */
var langBtns = {};
function syncUI() { Object.keys(langBtns).forEach(function (k) { langBtns[k].classList.toggle('on', k === lang); langBtns[k].setAttribute('aria-pressed', k === lang); }); }
function buildUI() {
  var css = document.createElement('style');
  css.textContent = '.sui{position:relative;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 14px;background:#fff;border-bottom:1px solid #e6eaf3;font-family:Figtree,"Noto Sans Bengali",system-ui,sans-serif;font-size:13px;color:#4a5670}' +
    '.sui:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:linear-gradient(90deg,#ff4d6d,#ffa62b,#2ee59d,#2ec4ff,#6c63ff,#d946ef)}' +
    '.sui .lb{display:flex;align-items:center;gap:7px;font-weight:700}.sui svg{width:18px;height:18px;stroke:#3b6cff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.sui .sg{display:flex;background:#eef2fb;border-radius:999px;padding:3px}' +
    '.sui button{all:unset;cursor:pointer;box-sizing:border-box;font:700 13px/1 Figtree,"Noto Sans Bengali",system-ui,sans-serif;padding:7px 14px;border-radius:999px;color:#4a5670}' +
    '.sui button.on{background:linear-gradient(135deg,#3b6cff,#7c4dff);color:#fff;box-shadow:0 4px 10px -4px rgba(76,80,255,.6)}' +
    '@media print{.sui{display:none!important}}';
  document.head.appendChild(css);
  var ui = document.createElement('div'); ui.className = 'sui';
  ui.innerHTML = '<span class="lb"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 4 6 4 9.5s-1.4 6.700-4 9.500c-2.600-2.800-4-6-4-9.500s1.400-6.700 4-9.500z"/></svg><span>Language / ভাষা</span></span>';
  var sg = document.createElement('div'); sg.className = 'sg';
  [['en', 'English'], ['bn', 'বাংলা']].forEach(function (p) {
    var b = document.createElement('button'); b.textContent = p[1];
    b.onclick = function () { if (lang !== p[0]) setLang(p[0]); }; langBtns[p[0]] = b; sg.appendChild(b);
  });
  ui.appendChild(sg); document.body.insertBefore(ui, document.body.firstChild);
  syncUI();
}

/* ---------------- scroll reveal ---------------- */
var RV_SEL = '.tile,.tool-link,.card,.pv-c,.sect,.st,.fc,.pv,.pvp,.outro,.hx-sec,.tp-sel,.shopcard';
var rvIO = null;
function reveal(root) {
  if (!('IntersectionObserver' in window) || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches)) return;
  document.documentElement.classList.add('js-rv');
  if (!rvIO) rvIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; rvIO.unobserve(el); el.classList.add('in');
      setTimeout(function () { el.classList.remove('rv', 'in'); el.style.removeProperty('--d'); }, 1100);
    });
  }, {threshold: .06, rootMargin: '0px 0px -5% 0px'});
  var list = []; if (root.matches && root.matches(RV_SEL)) list.push(root);
  if (root.querySelectorAll) [].push.apply(list, root.querySelectorAll(RV_SEL));
  list.forEach(function (el, i) {
    if (el.dataset.rv) return; if (el.closest && el.closest('#tilesBox')) return; el.dataset.rv = '1';
    el.style.setProperty('--d', ((i % 6) * 0.06) + 's'); el.classList.add('rv'); rvIO.observe(el);
  });
}

/* ---------------- visit counter (page view ping; the counter page itself is excluded) ---------------- */
function trackVisit() {
  try {
    var p = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '') || '/';
    if (/^\/(counter|poster)/.test(p)) return;
    var k = 'visit:' + p; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1');
    fetch('/api/visit', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({path: p}), keepalive: true}).catch(function () {});
  } catch (e) {}
}
/* ---------------- shared Privacy & Security modal + payment/security badges (identical on every page) ---------------- */
var PV_INNER = "<div class=\"wzm-s pm\" data-pv=\"10\"><div class=\"wzm-h\"><b id=\"pvT\">Privacy &amp; Security</b><button class=\"wz-x\" type=\"button\" data-wz-mclose aria-label=\"Close\">\u2715</button></div><div class=\"pm-body\"><div class=\"pm-hero\"><div class=\"pm-shield\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\"><path d=\"M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z\"/><rect x=\"9\" y=\"10.5\" width=\"6\" height=\"4.5\" rx=\"1\"/><path d=\"M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5\"/></svg></div><div><span class=\"pm-badge\" data-en=\"\ud83d\udd12 100% Private &amp; Auto-Deleted\" data-bn=\"\ud83d\udd12 \u09e7\u09e6\u09e6% \u0997\u09cb\u09aa\u09a8\u09c0\u09af\u09bc \u0993 \u0985\u099f\u09cb-\u09a1\u09bf\u09b2\u09bf\u099f\">\ud83d\udd12 100% Private &amp; Auto-Deleted</span><p class=\"pm-sub\" data-en=\"Your files are automatically wiped the moment printing finishes\u2014both from our shop PC and cloud server.\" data-bn=\"\u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f \u09b6\u09c7\u09b7 \u09b9\u0993\u09af\u09bc\u09be\u09b0 \u09b8\u09be\u09a5\u09c7 \u09b8\u09be\u09a5\u09c7\u0987 \u0986\u09aa\u09a8\u09be\u09b0 \u09ab\u09be\u0987\u09b2 \u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09a6\u09cb\u0995\u09be\u09a8\u09c7\u09b0 \u09aa\u09bf\u09b8\u09bf \u0993 \u0995\u09cd\u09b2\u09be\u0989\u09a1 \u09b8\u09be\u09b0\u09cd\u09ad\u09be\u09b0\u2014\u09a6\u09c1\u0987 \u099c\u09be\u09af\u09bc\u0997\u09be \u09a5\u09c7\u0995\u09c7\u0987 \u0985\u099f\u09cb\u09ae\u09c7\u099f\u09bf\u0995 \u09ae\u09c1\u099b\u09c7 \u09af\u09be\u09af\u09bc\u0964\">Your files are automatically wiped the moment printing finishes\u2014both from our shop PC and cloud server.</p></div></div><section class=\"pm-sec pm-dev\"><h3 class=\"pm-h\" data-en=\"\ud83d\udee0\ufe0f How PDF &amp; ID Card Tools Work (100% On-Device)\" data-bn=\"\ud83d\udee0\ufe0f PDF \u0993 \u0986\u0987\u09a1\u09bf \u0995\u09be\u09b0\u09cd\u09a1 \u099f\u09c1\u09b2\u09b8 \u0995\u09c0\u09ad\u09be\u09ac\u09c7 \u0995\u09be\u099c \u0995\u09b0\u09c7 (\u09e7\u09e6\u09e6% \u0985\u09a8-\u09a1\u09bf\u09ad\u09be\u0987\u09b8)\">\ud83d\udee0\ufe0f How PDF &amp; ID Card Tools Work (100% On-Device)</h3><div class=\"pm-flow\" role=\"list\"><div class=\"pm-st\" role=\"listitem\" style=\"--i:0\"><span class=\"pm-n\">1</span><b data-en=\"\ud83d\udcc4 Your PDF / Photo\" data-bn=\"\ud83d\udcc4 \u0986\u09aa\u09a8\u09be\u09b0 PDF / \u099b\u09ac\u09bf\">\ud83d\udcc4 Your PDF / Photo</b><small data-en=\"Pick a file from your phone or computer\" data-bn=\"\u09ab\u09cb\u09a8 \u09ac\u09be \u0995\u09ae\u09cd\u09aa\u09bf\u0989\u099f\u09be\u09b0 \u09a5\u09c7\u0995\u09c7 \u09ab\u09be\u0987\u09b2 \u09ac\u09c7\u099b\u09c7 \u09a8\u09bf\u09a8\">Pick a file from your phone or computer</small></div><div class=\"pm-ar\" aria-hidden=\"true\"><i></i></div><div class=\"pm-st\" role=\"listitem\" style=\"--i:1\"><span class=\"pm-n\">2</span><span class=\"pm-brbar\" aria-hidden=\"true\"><i></i><i></i><i></i><span class=\"pm-lock\">\ud83d\udd12</span></span><b data-en=\"\u26a1 Instant Browser Processing\" data-bn=\"\u26a1 \u09ac\u09cd\u09b0\u09be\u0989\u099c\u09be\u09b0\u09c7\u0987 \u099d\u099f\u09aa\u099f \u09aa\u09cd\u09b0\u09b8\u09c7\u09b8\u09bf\u0982\">\u26a1 Instant Browser Processing</b><small data-en=\"Merge, Split, Compress, Convert\" data-bn=\"\u09ae\u09be\u09b0\u09cd\u099c, \u09b8\u09cd\u09aa\u09cd\u09b2\u09bf\u099f, \u0995\u09ae\u09aa\u09cd\u09b0\u09c7\u09b8, \u0995\u09a8\u09ad\u09be\u09b0\u09cd\u099f\">Merge, Split, Compress, Convert</small></div><div class=\"pm-ar\" aria-hidden=\"true\"><i></i></div><div class=\"pm-st\" role=\"listitem\" style=\"--i:2\"><span class=\"pm-n\">3</span><span class=\"pm-wipe\" aria-hidden=\"true\"><em class=\"f\">\u2b07\ufe0f</em><em class=\"t\">\u2713</em></span><b data-en=\"\u2705 Direct Download to Phone\" data-bn=\"\u2705 \u09b8\u09b0\u09be\u09b8\u09b0\u09bf \u09ab\u09cb\u09a8\u09c7 \u09a1\u09be\u0989\u09a8\u09b2\u09cb\u09a1\">\u2705 Direct Download to Phone</b><small data-en=\"Saved straight to your device\" data-bn=\"\u09ab\u09be\u0987\u09b2 \u09b8\u09b0\u09be\u09b8\u09b0\u09bf \u0986\u09aa\u09a8\u09be\u09b0 \u09a1\u09bf\u09ad\u09be\u0987\u09b8\u09c7 \u09b8\u09c7\u09ad \u09b9\u09af\u09bc\">Saved straight to your device</small></div></div><p class=\"pm-zero\" role=\"note\" data-en=\"\ud83d\udeab Zero Server Upload \u00b7 Files NEVER leave your phone or computer!\" data-bn=\"\ud83d\udeab \u0995\u09cb\u09a8\u09cb \u09b8\u09be\u09b0\u09cd\u09ad\u09be\u09b0\u09c7 \u0986\u09aa\u09b2\u09cb\u09a1 \u09a8\u09c7\u0987 \u00b7 \u0986\u09aa\u09a8\u09be\u09b0 \u09ab\u09be\u0987\u09b2 \u0995\u0996\u09a8\u09cb \u09ab\u09cb\u09a8 \u09ac\u09be \u0995\u09ae\u09cd\u09aa\u09bf\u0989\u099f\u09be\u09b0\u09c7\u09b0 \u09ac\u09be\u0987\u09b0\u09c7 \u09af\u09be\u09af\u09bc \u09a8\u09be!\">\ud83d\udeab Zero Server Upload \u00b7 Files NEVER leave your phone or computer!</p></section><section class=\"pm-sec pm-web\"><h3 class=\"pm-h\" data-en=\"\ud83c\udf10 Website Print Flow\" data-bn=\"\ud83c\udf10 \u0993\u09af\u09bc\u09c7\u09ac\u09b8\u09be\u0987\u099f \u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f \u09ab\u09cd\u09b2\u09cb (\u0986\u09aa\u09b2\u09cb\u09a1 \u0993 \u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f)\">\ud83c\udf10 Website Print Flow</h3><div class=\"pm-flow\" role=\"list\"><div class=\"pm-st\" role=\"listitem\" style=\"--i:0\"><span class=\"pm-n\">1</span><b data-en=\"\ud83d\udcf1 Upload via HTTPS\" data-bn=\"\ud83d\udcf1 HTTPS-\u098f \u0986\u09aa\u09b2\u09cb\u09a1\">\ud83d\udcf1 Upload via HTTPS</b><small data-en=\"Encrypted while it travels\" data-bn=\"\u09aa\u09be\u09a0\u09be\u09a8\u09cb\u09b0 \u09b8\u09ae\u09af\u09bc \u098f\u09a8\u0995\u09cd\u09b0\u09bf\u09aa\u09cd\u099f\u09c7\u09a1\">Encrypted while it travels</small></div><div class=\"pm-ar\" aria-hidden=\"true\"><i></i></div><div class=\"pm-st\" role=\"listitem\" style=\"--i:1\"><span class=\"pm-n\">2</span><b data-en=\"\u2601\ufe0f Encrypted Temp Queue\" data-bn=\"\u2601\ufe0f \u098f\u09a8\u0995\u09cd\u09b0\u09bf\u09aa\u09cd\u099f\u09c7\u09a1 \u0985\u09b8\u09cd\u09a5\u09be\u09af\u09bc\u09c0 \u0995\u09bf\u0989\">\u2601\ufe0f Encrypted Temp Queue</b><small data-en=\"Held briefly until paid (auto-delete in 60 min if unpaid)\" data-bn=\"\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f \u09a8\u09be \u09b9\u0993\u09af\u09bc\u09be \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4 \u09b8\u09be\u09ae\u09af\u09bc\u09bf\u0995 (\u09ac\u09be\u0995\u09bf \u09a5\u09be\u0995\u09b2\u09c7 \u09ec\u09e6 \u09ae\u09bf\u09a8\u09bf\u099f\u09c7 \u0985\u099f\u09cb-\u09a1\u09bf\u09b2\u09bf\u099f)\">Held briefly until paid (auto-delete in 60 min if unpaid)</small></div><div class=\"pm-ar\" aria-hidden=\"true\"><i></i></div><div class=\"pm-st\" role=\"listitem\" style=\"--i:2\"><span class=\"pm-n\">3</span><span class=\"pm-wipe\" aria-hidden=\"true\"><em class=\"f\">\ud83d\udcc4</em><em class=\"t\">\u2713</em></span><b data-en=\"\ud83d\udda8\ufe0f Printed &amp; Instantly Wiped\" data-bn=\"\ud83d\udda8\ufe0f \u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f \u0993 \u09b8\u0999\u09cd\u0997\u09c7 \u09b8\u0999\u09cd\u0997\u09c7 \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09be\">\ud83d\udda8\ufe0f Printed &amp; Instantly Wiped</b><small data-en=\"Deleted from the shop PC and the server right after printing\" data-bn=\"\u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f\u09c7\u09b0 \u09aa\u09b0\u09c7\u0987 \u09a6\u09cb\u0995\u09be\u09a8\u09c7\u09b0 \u09aa\u09bf\u09b8\u09bf \u0993 \u09b8\u09be\u09b0\u09cd\u09ad\u09be\u09b0 \u09a5\u09c7\u0995\u09c7 \u09ab\u09be\u0987\u09b2 \u09ae\u09c1\u099b\u09c7 \u09af\u09be\u09af\u09bc\">Deleted from the shop PC and the server right after printing</small></div></div></section><section class=\"pm-sec pm-wa\"><h3 class=\"pm-h\" data-en=\"\ud83d\udcac WhatsApp Print Bot Flow\" data-bn=\"\ud83d\udcac WhatsApp \u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f \u09ac\u099f \u09ab\u09cd\u09b2\u09cb\">\ud83d\udcac WhatsApp Print Bot Flow</h3><div class=\"pm-flow\" role=\"list\"><div class=\"pm-st\" role=\"listitem\" style=\"--i:0\"><span class=\"pm-n\">1</span><b data-en=\"\ud83d\udcac Send File on WhatsApp\" data-bn=\"\ud83d\udcac WhatsApp-\u098f \u09ab\u09be\u0987\u09b2 \u09aa\u09be\u09a0\u09be\u09a8\">\ud83d\udcac Send File on WhatsApp</b><small data-en=\"Message your file to the shop number\" data-bn=\"\u09a6\u09cb\u0995\u09be\u09a8\u09c7\u09b0 \u09a8\u09ae\u09cd\u09ac\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u09ab\u09be\u0987\u09b2 \u09aa\u09be\u09a0\u09be\u09a8\">Message your file to the shop number</small></div><div class=\"pm-ar\" aria-hidden=\"true\"><i></i></div><div class=\"pm-st\" role=\"listitem\" style=\"--i:1\"><span class=\"pm-n\">2</span><b data-en=\"\u26a1 Pay UPI QR / Cash Token\" data-bn=\"\u26a1 UPI QR / \u0995\u09cd\u09af\u09be\u09b6 \u099f\u09cb\u0995\u09c7\u09a8\u09c7 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f\">\u26a1 Pay UPI QR / Cash Token</b><small data-en=\"Pay by UPI QR or with a cash token\" data-bn=\"UPI QR \u09ac\u09be \u0995\u09cd\u09af\u09be\u09b6 \u099f\u09cb\u0995\u09c7\u09a8\u09c7 \u099f\u09be\u0995\u09be \u09a6\u09bf\u09a8\">Pay by UPI QR or with a cash token</small></div><div class=\"pm-ar\" aria-hidden=\"true\"><i></i></div><div class=\"pm-st\" role=\"listitem\" style=\"--i:2\"><span class=\"pm-n\">3</span><span class=\"pm-wipe\" aria-hidden=\"true\"><em class=\"f\">\ud83d\udcc4</em><em class=\"t\">\u2713</em></span><b data-en=\"\ud83d\udda8\ufe0f Auto-Print &amp; Immediate File Purge\" data-bn=\"\ud83d\udda8\ufe0f \u0985\u099f\u09cb-\u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f \u0993 \u09b8\u0999\u09cd\u0997\u09c7 \u09b8\u0999\u09cd\u0997\u09c7 \u09ab\u09be\u0987\u09b2 \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09be\">\ud83d\udda8\ufe0f Auto-Print &amp; Immediate File Purge</b><small data-en=\"Prints automatically, then the file is purged\" data-bn=\"\u09a8\u09bf\u099c\u09c7 \u09a5\u09c7\u0995\u09c7\u0987 \u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f \u09b9\u09af\u09bc, \u09a4\u09be\u09b0\u09aa\u09b0 \u09ab\u09be\u0987\u09b2 \u09ae\u09c1\u099b\u09c7 \u09af\u09be\u09af\u09bc\">Prints automatically, then the file is purged</small></div></div></section><div class=\"pm-g\"><div class=\"pm-gc\"><b data-en=\"\ud83d\uddd1\ufe0f Wiped from Shop PC\" data-bn=\"\ud83d\uddd1\ufe0f \u09a6\u09cb\u0995\u09be\u09a8\u09c7\u09b0 \u09aa\u09bf\u09b8\u09bf \u09a5\u09c7\u0995\u09c7 \u09ae\u09c1\u099b\u09c7 \u09af\u09be\u09af\u09bc\">\ud83d\uddd1\ufe0f Wiped from Shop PC</b><span data-en=\"Temp copy is erased immediately after print.\" data-bn=\"\u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f\u09c7\u09b0 \u09b8\u09be\u09a5\u09c7 \u09b8\u09be\u09a5\u09c7\u0987 \u0985\u09b8\u09cd\u09a5\u09be\u09af\u09bc\u09c0 \u0995\u09aa\u09bf \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09be \u09b9\u09af\u09bc\u0964\">Temp copy is erased immediately after print.</span></div><div class=\"pm-gc\"><b data-en=\"\u23f1\ufe0f 60-Min Unpaid Expiry\" data-bn=\"\u23f1\ufe0f \u09ec\u09e6 \u09ae\u09bf\u09a8\u09bf\u099f\u09c7 \u0985\u09aa\u09b0\u09bf\u09b6\u09cb\u09a7\u09bf\u09a4 \u09ae\u09c7\u09af\u09bc\u09be\u09a6 \u09b6\u09c7\u09b7\">\u23f1\ufe0f 60-Min Unpaid Expiry</b><span data-en=\"Unpaid or abandoned uploads auto-delete in 60 minutes.\" data-bn=\"\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f \u09a8\u09be \u09b9\u0993\u09af\u09bc\u09be \u09ac\u09be \u0985\u09b8\u09ae\u09be\u09aa\u09cd\u09a4 \u0986\u09aa\u09b2\u09cb\u09a1 \u09ec\u09e6 \u09ae\u09bf\u09a8\u09bf\u099f\u09c7 \u0985\u099f\u09cb-\u09a1\u09bf\u09b2\u09bf\u099f \u09b9\u09af\u09bc\u0964\">Unpaid or abandoned uploads auto-delete in 60 minutes.</span></div></div><p class=\"pm-fn\" data-en=\"Visit counter: we log your IP address and approximate city; these logs are deleted after 90 days.\" data-bn=\"\u09ad\u09bf\u099c\u09bf\u099f \u0995\u09be\u0989\u09a8\u09cd\u099f\u09be\u09b0: \u0986\u09ae\u09b0\u09be \u0986\u09aa\u09a8\u09be\u09b0 IP \u0985\u09cd\u09af\u09be\u09a1\u09cd\u09b0\u09c7\u09b8 \u0993 \u0986\u09a8\u09c1\u09ae\u09be\u09a8\u09bf\u0995 \u09b6\u09b9\u09b0 \u09b2\u0997 \u0995\u09b0\u09bf; \u098f\u0987 \u09b2\u0997 \u09ef\u09e6 \u09a6\u09bf\u09a8 \u09aa\u09b0 \u09ae\u09c1\u099b\u09c7 \u09af\u09be\u09af\u09bc\u0964\">Visit counter: we log your IP address and approximate city; these logs are deleted after 90 days.</p><div class=\"trust trust-m\" role=\"group\" aria-label=\"Payments &amp; Security\"><span class=\"tb tb-rz\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 2.4l8 3v6.1c0 5-3.3 8.7-8 10.1-4.7-1.4-8-5.100-8-10.100V5.400z\" fill=\"#2563eb\"/><rect x=\"7\" y=\"9.200\" width=\"10\" height=\"6.600\" rx=\"1.500\" fill=\"#fff\"/><rect x=\"7\" y=\"10.800\" width=\"10\" height=\"1.600\" fill=\"#02042b\"/><rect x=\"8.400\" y=\"13.800\" width=\"3\" height=\"1\" rx=\".5\" fill=\"#2563eb\"/></svg><span class=\"tb-t\"><span data-en=\"Payments Powered &amp; Secured by \" data-bn=\"\">Payments Powered &amp; Secured by </span><b>Razorpay</b><span data-en=\"\" data-bn=\" \u09a6\u09cd\u09ac\u09be\u09b0\u09be \u099a\u09be\u09b2\u09bf\u09a4 \u0993 \u09b8\u09c1\u09b0\u0995\u09cd\u09b7\u09bf\u09a4 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f\"></span></span></span><span class=\"tb tb-cf\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7.200 18.500a4.600 4.600 0 0 1-.7-9.150A6.100 6.100 0 0 1 18.200 9a4.800 4.800 0 0 1-.4 9.500z\" fill=\"#f59e0b\"/><rect x=\"9.800\" y=\"11.600\" width=\"4.400\" height=\"3.800\" rx=\".9\" fill=\"#fff\"/><path d=\"M10.700 11.600v-.9a1.300 1.300 0 0 1 2.600 0v.9\" fill=\"none\" stroke=\"#ea580c\" stroke-width=\"1.200\" stroke-linecap=\"round\"/></svg><span class=\"tb-t\"><span data-en=\"Secured by \" data-bn=\"\">Secured by </span><b>Cloudflare</b><span data-en=\"\" data-bn=\" \u09a6\u09cd\u09ac\u09be\u09b0\u09be \u09b8\u09c1\u09b0\u0995\u09cd\u09b7\u09bf\u09a4\"></span></span></span></div></div></div>";
var TRUST_HTML = "<div class=\"trust\" role=\"group\" aria-label=\"Payments &amp; Security\"><span class=\"tb tb-rz\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 2.4l8 3v6.1c0 5-3.3 8.7-8 10.1-4.7-1.4-8-5.100-8-10.100V5.400z\" fill=\"#2563eb\"/><rect x=\"7\" y=\"9.200\" width=\"10\" height=\"6.600\" rx=\"1.500\" fill=\"#fff\"/><rect x=\"7\" y=\"10.800\" width=\"10\" height=\"1.600\" fill=\"#02042b\"/><rect x=\"8.400\" y=\"13.800\" width=\"3\" height=\"1\" rx=\".5\" fill=\"#2563eb\"/></svg><span class=\"tb-t\"><span data-en=\"Payments Powered &amp; Secured by \" data-bn=\"\">Payments Powered &amp; Secured by </span><b>Razorpay</b><span data-en=\"\" data-bn=\" \u09a6\u09cd\u09ac\u09be\u09b0\u09be \u099a\u09be\u09b2\u09bf\u09a4 \u0993 \u09b8\u09c1\u09b0\u0995\u09cd\u09b7\u09bf\u09a4 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f\"></span></span></span><span class=\"tb tb-cf\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7.200 18.500a4.600 4.600 0 0 1-.7-9.150A6.100 6.100 0 0 1 18.200 9a4.800 4.800 0 0 1-.4 9.500z\" fill=\"#f59e0b\"/><rect x=\"9.800\" y=\"11.600\" width=\"4.400\" height=\"3.800\" rx=\".9\" fill=\"#fff\"/><path d=\"M10.700 11.600v-.9a1.300 1.300 0 0 1 2.600 0v.9\" fill=\"none\" stroke=\"#ea580c\" stroke-width=\"1.200\" stroke-linecap=\"round\"/></svg><span class=\"tb-t\"><span data-en=\"Secured by \" data-bn=\"\">Secured by </span><b>Cloudflare</b><span data-en=\"\" data-bn=\" \u09a6\u09cd\u09ac\u09be\u09b0\u09be \u09b8\u09c1\u09b0\u0995\u09cd\u09b7\u09bf\u09a4\"></span></span></span></div>";
function ensureShared() {
  try {
    var m = document.getElementById('pvModal');
    if (!m && document.querySelector('[data-wz-modal="pvModal"]')) {
      m = document.createElement('div'); m.className = 'wzm'; m.id = 'pvModal';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-hidden', 'true'); m.setAttribute('aria-labelledby', 'pvT');
      document.body.appendChild(m); m.innerHTML = PV_INNER;
    } else if (m && !m.querySelector('.wzm-s[data-pv="10"]')) { m.innerHTML = PV_INNER; }
    var f = document.querySelector('footer.cf');
    if (f && !f.querySelector('.trust')) {
      var n = f.querySelector('.cf-n');
      if (n) n.insertAdjacentHTML('beforebegin', TRUST_HTML); else f.insertAdjacentHTML('beforeend', TRUST_HTML);
    }
  } catch (e) {}
}
function init() {
  buildUI();
  ensureShared();
  trackVisit();
  if (lang === 'bn') { document.documentElement.lang = 'bn'; }
  walk(document.body);
  dataLang();
  reveal(document.body);
  mo.observe(document.body, {childList: true, subtree: true, characterData: true});
  var warm = function () { var w = document.createElement('span'); w.setAttribute('aria-hidden', 'true'); w.style.cssText = 'position:absolute;left:-9999px;top:0;font:700 14px "Noto Sans Bengali",sans-serif'; w.textContent = 'বাংলা অআইউ কখগ'; document.body.appendChild(w); };
  (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(warm);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
