// app/legal/terms.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const TermsScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.updated}>
          Last updated: 07 December 2025
        </Text>

        <Text style={styles.sectionTitle}>Welcome to KashmirCart</Text>
        <Text style={styles.bodyText}>
          These Terms and Conditions (&quot;Terms&quot;) govern your use of the
          KashmirCart mobile application, website, and related services
          (collectively, the &quot;Service&quot;). By creating an account,
          requesting an OTP, or using KashmirCart in any way, you agree to these
          Terms. If you do not agree, please do not use the Service.
        </Text>

        <Text style={styles.sectionTitle}>1. Eligibility and Account</Text>
        <Text style={styles.bodyText}>
          1.1 You must be at least 18 years old to create an account and place
          orders on KashmirCart.{"\n\n"}
          1.2 You agree to provide accurate, complete and up-to-date
          information during registration and when updating your profile,
          including your name, email address, phone number and delivery
          address.{"\n\n"}
          1.3 You are responsible for maintaining the confidentiality of your
          account, OTP codes and any other authentication methods used with
          KashmirCart.{"\n\n"}
          1.4 You agree to immediately notify us if you suspect any
          unauthorized use of your account or OTP.
        </Text>

        <Text style={styles.sectionTitle}>
          2. OTP, Login and Security
        </Text>
        <Text style={styles.bodyText}>
          2.1 KashmirCart currently uses email-based OTP verification for
          registration and login. Phone numbers are stored for profile and
          delivery purposes but are not used for OTP on the free tier.{"\n\n"}
          2.2 OTPs are for your personal use only and must not be shared with
          anyone, including KashmirCart staff or delivery partners.{"\n\n"}
          2.3 You are solely responsible for all activities that occur under
          your account after successful OTP verification.{"\n\n"}
          2.4 We are not liable for any loss or damage resulting from
          unauthorized access caused by your failure to keep your email, OTP
          or device secure.
        </Text>

        <Text style={styles.sectionTitle}>
          3. Personal Information and Privacy
        </Text>
        <Text style={styles.bodyText}>
          3.1 By using KashmirCart, you consent to our collection and use of
          information such as your name, email, phone number, address, and
          order details.{"\n\n"}
          3.2 We use this information to create and manage your account,
          process and deliver your orders, send OTPs and order updates, and
          improve our services.{"\n\n"}
          3.3 We may share necessary details with delivery partners, payment
          gateways and service providers that help us operate KashmirCart.
          We do not sell your personal information to third parties.{"\n\n"}
          3.4 For more details, please refer to our Privacy Policy once it is
          published on the website/app.
        </Text>

        <Text style={styles.sectionTitle}>
          4. Products, Pricing and Availability
        </Text>
        <Text style={styles.bodyText}>
          4.1 KashmirCart lists products from various shops and partners.
          Product images and descriptions are for reference and may slightly
          differ from the actual items.{"\n\n"}
          4.2 Prices shown in the app or website may change at any time without
          prior notice. Final pricing, including any taxes and delivery
          charges, is confirmed at checkout.{"\n\n"}
          4.3 All products and offers are subject to availability. If a product
          becomes unavailable after you place an order, we may cancel the item,
          update your order, or contact you with alternatives.
        </Text>

        <Text style={styles.sectionTitle}>
          5. Orders, Payment and COD
        </Text>
        <Text style={styles.bodyText}>
          5.1 Placing an order on KashmirCart is an offer to purchase the
          selected product(s) under these Terms. We may accept or reject any
          order at our sole discretion.{"\n\n"}
          5.2 Payment methods may include online payment via our payment
          partners and Cash on Delivery (&quot;COD&quot;) where available.{"\n\n"}
          5.3 For COD orders, you agree to pay the exact amount in cash at the
          time of delivery. Repeated COD failures or misuse may lead to
          restrictions on COD or suspension of your account.
        </Text>

        <Text style={styles.sectionTitle}>6. Delivery</Text>
        <Text style={styles.bodyText}>
          6.1 Delivery times shown in the app are estimates and can be affected
          by traffic, weather, stock and other local conditions.{"\n\n"}
          6.2 You agree to provide a complete, accurate address and to be
          reachable on your phone during delivery.{"\n\n"}
          6.3 If delivery fails because of incorrect address, unreachable
          contact or repeated refusal to accept orders, we may cancel the
          order and still charge applicable delivery fees and restrict future
          service.
        </Text>

        <Text style={styles.sectionTitle}>
          7. Returns, Refunds and Cancellations
        </Text>
        <Text style={styles.bodyText}>
          7.1 Our returns and refunds options may vary by product category.
          Certain items, including some cosmetics and personal care products,
          may be non-returnable for hygiene and safety reasons.{"\n\n"}
          7.2 If you receive a wrong, damaged or missing item, you should
          report it within the time limit specified in the app and provide
          photos or other evidence as requested.{"\n\n"}
          7.3 Approved refunds will be processed via the original payment
          method, as store credit, or via UPI/bank transfer as per our process
          and timelines.{"\n\n"}
          7.4 We may refuse returns or refunds if items have been used,
          tampered with, or damaged after delivery, or if the claim is found
          to be fraudulent.
        </Text>

        <Text style={styles.sectionTitle}>8. User Conduct</Text>
        <Text style={styles.bodyText}>
          8.1 You agree not to use KashmirCart for any unlawful, abusive or
          fraudulent purpose.{"\n\n"}
          8.2 You must not interfere with or disrupt the app, its servers or
          networks, or attempt to bypass security or authentication measures.{"\n\n"}
          8.3 You must not harass, threaten or abuse delivery partners, staff
          or other users.{"\n\n"}
          8.4 We may suspend or terminate accounts involved in fraud, COD
          abuse, misuse of offers or serious policy violations.
        </Text>

        <Text style={styles.sectionTitle}>9. Intellectual Property</Text>
        <Text style={styles.bodyText}>
          9.1 All logos, graphics, designs, text and other content displayed in
          KashmirCart are owned by or licensed to us.{"\n\n"}
          9.2 You may not copy, modify, reproduce or create derivative works
          from any part of the Service without our prior written consent.
        </Text>

        <Text style={styles.sectionTitle}>10. Third-Party Services</Text>
        <Text style={styles.bodyText}>
          10.1 KashmirCart may include or link to services provided by third
          parties, such as payment gateways, map providers or notification
          services.{"\n\n"}
          10.2 Your use of third-party services is subject to their own terms
          and privacy policies. We are not responsible for their content or
          practices.
        </Text>

        <Text style={styles.sectionTitle}>
          11. Limitation of Liability
        </Text>
        <Text style={styles.bodyText}>
          11.1 To the maximum extent permitted by law, KashmirCart, its owners,
          employees and partners will not be liable for any indirect,
          incidental or consequential damages arising from your use of the
          Service.{"\n\n"}
          11.2 Our total liability for any claim relating to the Service will
          be limited to the value of the order in question, if applicable.
        </Text>

        <Text style={styles.sectionTitle}>
          12. Changes to These Terms
        </Text>
        <Text style={styles.bodyText}>
          12.1 We may update these Terms from time to time. Updated versions
          will be available in the app and/or on our website with a revised
          &quot;Last updated&quot; date.{"\n\n"}
          12.2 Your continued use of KashmirCart after any update means you
          accept the revised Terms.
        </Text>

        <Text style={styles.sectionTitle}>
          13. Governing Law and Contact
        </Text>
        <Text style={styles.bodyText}>
          These Terms are governed by the laws of India. Any disputes will be
          subject to the exclusive jurisdiction of the courts in your local
          district/state (e.g., Kupwara, Jammu & Kashmir).{"\n\n"}
          For questions or support, you can contact us at:
          {"\n"}• Email: support@kashmircart.online
          {"\n"}• Website: https://kashmircart.online
        </Text>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  screen: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  updated: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
});
