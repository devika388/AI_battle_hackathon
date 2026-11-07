# 🍃 FoodBridge – Don't Waste It. Bridge It.

### Connecting Surplus Food with Those Who Need It.

FoodBridge is a food-rescue platform designed to reduce food wastage by connecting food donors, NGOs, and delivery partners through a coordinated food distribution system.

The platform helps surplus food reach people who need it through intelligent NGO matching, delivery partner coordination, real-time status tracking (in the implemented system), and an alternative Community Rescue mechanism.

Our mission is simple: **Give every safe surplus food donation a second chance.**

---

## 🌍 Problem Statement

Every day, restaurants, hotels, and other food establishments generate surplus food, while many communities struggle with food insecurity.

The problem is not always the availability of food but the lack of proper coordination between donors, NGOs, and transportation partners.

Common challenges include:

- Food wastage due to poor coordination.
- Difficulty finding nearby NGOs that can accept surplus food.
- Lack of available delivery partners.
- Delays in food collection and distribution.
- No transparent way to track donated food.
- Missed opportunities to redistribute safe surplus food.

## 💡 Our Solution

FoodBridge provides a centralized platform that coordinates the entire food-rescue journey.

It enables:

- Food donors to list surplus food donations.
- NGOs to discover and accept suitable donations.
- Intelligent matching based on location, food category, capacity, and availability.
- Delivery partner assignment.
- Donation tracking through a Food Passport.
- Community Rescue Mode when regular NGO matching fails.
- Impact tracking through donation and delivery records.

---

## ✨ Key Features

### 1. Food Donation Management
- Simple food donation form.
- Food category and quantity selection.
- Preparation date and time.
- Storage and handling information.
- Ingredient and allergen details.
- Pickup location and safe handling deadline.
- Unique donation identification.

### 2. Intelligent NGO Matching
FoodBridge recommends suitable NGOs based on:

- Geographic distance.
- Food category compatibility.
- Available food acceptance capacity.
- NGO availability.

Each recommendation includes an explanation of why the NGO is suitable.

### 3. Delivery Partner Assignment
- Identifies available delivery partners.
- Checks delivery capacity.
- Prioritizes suitable nearby partners.
- Coordinates food pickup and delivery.

### 4. Food Passport
Every donation receives a traceable journey through the following statuses:

`Listed → Matched → Partner Assigned → Picked Up → Delivered → Confirmed`

This provides transparency and accountability throughout the rescue process.

### 5. Community Rescue Mode
A special fallback mechanism designed for situations where no NGO accepts a donation.

The system:
- Initiates an escalation process.
- Expands NGO search and sends reminders.
- Checks the declared food-safety deadline.
- Coordinates eligible alternative distribution.
- Records distribution details and supporting proof.

**Food safety always takes priority.** Food that is outside its safe handling window or has uncertain safety is not eligible for redistribution.

### 6. Impact Tracking
FoodBridge tracks measurable outcomes such as:

- Meals donated.
- Successful deliveries.
- Participating NGOs.
- Supported delivery partners.

Impact figures are calculated from available records. Sample figures are clearly identified as demonstration data.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Website structure |
| CSS3 | Styling and responsive design |
| Vanilla JavaScript | Functionality and interactions |
| LocalStorage | Local demonstration data persistence |
| Supabase (Optional) | Database, authentication and storage |
| Leaflet + OpenStreetMap (Optional) | Interactive maps |
| Chart.js (Optional) | Impact and analytics charts |
| Git & GitHub | Version control |
| Render | Website deployment |

**Note:** The frontend implementation uses plain HTML, CSS and Vanilla JavaScript without React, Vite, or another frontend framework.

---

## 📁 Project Structure

```text
FoodBridge/
│
├── index.html
├── README.md
├── .gitignore
│
├── assets/
│   ├── images/
│   └── icons/
│
├── css/
│   ├── style.css
│   └── responsive.css
│
├── js/
│   ├── data.js
│   ├── app.js
│   ├── matching.js
│   ├── rescue.js
│   └── storage.js
│
└── pages/
    ├── donor.html
    ├── ngo.html
    ├── partner.html
    └── admin.html
```

*Optional files and pages can be added as the project develops.*

---

## ⚙️ Getting Started

### Prerequisites

- Visual Studio Code
- A modern web browser
- VS Code Live Server extension (recommended)
- Git (for version control)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/YOUR-USERNAME/foodbridge.git
```

**2. Navigate to the project directory**

```bash
cd foodbridge
```

**3. Open the project in VS Code**

```bash
code .
```

**4. Run the website**

Open `index.html` using the Live Server extension.

The website will open in your default browser.

No frontend build command or package installation is required for the plain HTML/CSS/JavaScript implementation.

---

## 🔄 How FoodBridge Works

### Normal Food Rescue Journey

1. A donor lists surplus food.
2. FoodBridge identifies suitable NGOs.
3. The NGO accepts the donation.
4. A suitable delivery partner is assigned.
5. The partner collects the food.
6. The partner delivers the food to the NGO.
7. The NGO confirms receipt through OTP/QR verification.
8. The donation status and impact records are updated.

### Community Rescue Journey

1. No NGO accepts the donation within the configured escalation period.
2. The system initiates an alternative rescue process.
3. Food safety and the declared handling deadline are checked again.
4. If eligible, a verified partner and approved distribution location are assigned.
5. Distribution details and supporting proof are recorded.
6. Authorized review determines whether the outcome can count as verified impact.

---

## 🔐 Data Management and Security

The prototype uses browser LocalStorage for demonstration purposes.

Important considerations:

- LocalStorage data is limited to the same browser and device.
- LocalStorage is not secure or authoritative storage.
- Shared records require a backend or database such as Supabase.
- Database access should use Row Level Security.
- Private API keys and database credentials must never be exposed in frontend code.
- Sensitive personal information should not be publicly displayed.

---

## 🥗 Food Safety and Privacy

FoodBridge is a coordination platform, not a food-safety certification system.

The platform considers:

- Food preparation time.
- Storage and handling conditions.
- Ingredients and allergens.
- Declared safe handling deadline.
- Pickup and delivery feasibility.

A matching score, AI suggestion, photograph, or countdown cannot establish that food is safe to consume.

Recipient identities and private contact information must remain protected.

---

## 🚀 Deployment

FoodBridge can be deployed as a static website using Render.

### Deployment Steps

1. Push the project to GitHub.
2. Log in to Render.
3. Select **New → Static Site**.
4. Connect your GitHub repository.
5. Select the appropriate branch.
6. Leave the Build Command empty.
7. Set the Publish Directory to:

```text
.
```

8. Click Create Static Site.
9. Wait for deployment to complete.
10. Access your public FoodBridge website through the generated Render URL.

---

## 🧪 Testing

The following scenarios should be tested before deployment:

- Successful food donation.
- Missing required donation details.
- NGO acceptance and rejection.
- No eligible delivery partner.
- Successful pickup and delivery.
- NGO receipt confirmation.
- No NGO acceptance and Community Rescue escalation.
- Food outside the safe handling window.
- Community distribution proof submission.
- Mobile and responsive website functionality.

---

## 🌱 Future Enhancements

Potential improvements include:

- Interactive donor, NGO and delivery partner maps.
- QR-based Food Passport tracking.
- AI-assisted food categorization.
- Food demand prediction.
- Delivery route optimization.
- Partner ratings and backup assignment.
- Downloadable donation impact reports.
- Shared database and role-based authentication.

---

## 🎯 Our Vision

We envision a world where surplus food does not go to waste simply because the right people, organizations, and transportation systems cannot connect in time.

FoodBridge brings these elements together through a coordinated, transparent, and safety-conscious food-rescue ecosystem.

### Don't Waste It. Bridge It. 🌿

**FoodBridge – Every Safe Meal Deserves a Second Chance.**
