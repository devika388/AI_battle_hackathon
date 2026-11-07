import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout, FormMessage, FormSubmit } from "../components/auth/AuthLayout";
import { InputField, SelectField, type SelectOption } from "../components/ui";
import { ApiError, requestJson } from "../services/apiClient";
import { getSupabaseClient } from "../services/supabaseClient";

type PublicRole = "donor" | "ngo" | "delivery_partner";

const roleOptions: SelectOption[] = [
  { label: "Food donor", value: "donor" },
  { label: "NGO / community organization", value: "ngo" },
  { label: "Delivery partner", value: "delivery_partner" },
];

const donorTypes: SelectOption[] = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Grocery store", value: "grocery" },
  { label: "Hotel", value: "hotel" },
  { label: "Caterer", value: "caterer" },
  { label: "Other food business", value: "other" },
];

const vehicleTypes: SelectOption[] = [
  { label: "Bicycle", value: "bicycle" },
  { label: "Motorcycle", value: "motorcycle" },
  { label: "Car", value: "car" },
  { label: "Van", value: "van" },
  { label: "Truck", value: "truck" },
  { label: "Other", value: "other" },
];

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

export function RegistrationPage() {
  const { configError, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<PublicRole>(() => {
    const requestedRole = searchParams.get("role");
    return roleOptions.some((option) => option.value === requestedRole)
      ? (requestedRole as PublicRole)
      : "donor";
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (configError) return;
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = text(data, "email").toLowerCase();
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirm_password") ?? "");

    if (password.length < 10 || password.length > 72) {
      setMessage("Use a password between 10 and 72 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Enter a valid email address.");
      return;
    }

    let registration: Record<string, string>;
    if (role === "donor") {
      registration = {
        role,
        full_name: text(data, "full_name"),
        phone: text(data, "phone"),
        organization_name: text(data, "organization_name"),
        donor_type: text(data, "donor_type"),
        address: text(data, "address"),
        city: text(data, "city"),
      };
    } else if (role === "ngo") {
      registration = {
        role,
        full_name: text(data, "contact_person"),
        phone: text(data, "phone"),
        organization_name: text(data, "organization_name"),
        registration_number: text(data, "registration_number"),
        address: text(data, "address"),
        city: text(data, "city"),
      };
    } else {
      registration = {
        role,
        full_name: text(data, "full_name"),
        phone: text(data, "phone"),
        vehicle_type: text(data, "vehicle_type"),
        vehicle_number: text(data, "vehicle_number"),
      };
    }

    setLoading(true);
    try {
      const { data: result, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { data: { registration } },
      });
      if (error) {
        setMessage(error.message);
        return;
      }

      if (result.session) {
        await requestJson<{ profile: { role: string } }>(
          "/auth/complete-registration",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${result.session.access_token}` },
          },
        );
        await refreshProfile(result.session.access_token);
        navigate("/dashboard", { replace: true });
        return;
      }

      setMessage(
        "Email confirmation is still enabled in Supabase. Turn off Confirm email under Authentication → Providers → Email, then try registering again.",
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "We couldn't create your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Join the FoodBridge community"
      title="Let’s get started."
      description="Create an account to take part in a more thoughtful food system. Choose your role to see the details we need."
    >
      <form className="space-y-5" onSubmit={submit}>
        <SelectField
          id="registration-role"
          label="I’m joining as"
          onChange={(event) => {
            setRole(event.target.value as PublicRole);
            setMessage("");
          }}
          options={roleOptions}
          value={role}
        />

        {role === "donor" ? (
          <DonorFields />
        ) : role === "ngo" ? (
          <NgoFields />
        ) : (
          <PartnerFields />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <InputField
            autoComplete="email"
            id="registration-email"
            label="Email address"
            maxLength={254}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
          <InputField
            autoComplete="new-password"
            id="registration-password"
            label="Password"
            maxLength={72}
            minLength={10}
            name="password"
            placeholder="At least 10 characters"
            required
            type="password"
          />
        </div>
        <InputField
          autoComplete="new-password"
          id="registration-confirm-password"
          label="Confirm password"
          maxLength={72}
          minLength={10}
          name="confirm_password"
          placeholder="Enter your password again"
          required
          type="password"
        />

        {message ? <FormMessage message={message} /> : null}
        <FormSubmit disabled={Boolean(configError)} loading={loading}>
          Create account
        </FormSubmit>
        <p className="text-xs leading-5 text-slate-500">
          NGOs and delivery partners remain pending until an administrator
          approves their registration. Admin accounts cannot be created here.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-semibold text-forest hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function DonorFields() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          autoComplete="name"
          id="donor-full-name"
          label="Full name"
          maxLength={120}
          name="full_name"
          placeholder="Your name"
          required
        />
        <InputField
          autoComplete="tel"
          id="donor-phone"
          label="Phone"
          maxLength={40}
          name="phone"
          pattern="^\+?[0-9\s().-]{7,20}$"
          placeholder="+1 555 010 1234"
          required
          type="tel"
        />
      </div>
      <InputField
        autoComplete="organization"
        id="donor-organization"
        label="Organization name"
        maxLength={160}
        name="organization_name"
        placeholder="Business or organization"
        required
      />
      <SelectField
        id="donor-type"
        label="Donor type"
        name="donor_type"
        options={donorTypes}
        required
      />
      <AddressFields prefix="donor" />
    </div>
  );
}

function NgoFields() {
  return (
    <div className="space-y-5">
      <InputField
        autoComplete="organization"
        id="ngo-organization"
        label="Organization name"
        maxLength={160}
        name="organization_name"
        placeholder="Registered organization name"
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          id="ngo-registration-number"
          label="Registration number"
          maxLength={120}
          name="registration_number"
          placeholder="Official registration number"
          required
        />
        <InputField
          autoComplete="name"
          id="ngo-contact-person"
          label="Contact person"
          maxLength={120}
          name="contact_person"
          placeholder="Full name"
          required
        />
      </div>
      <InputField
        autoComplete="tel"
        id="ngo-phone"
        label="Phone"
        maxLength={40}
        name="phone"
        pattern="^\+?[0-9\s().-]{7,20}$"
        placeholder="+1 555 010 1234"
        required
        type="tel"
      />
      <AddressFields prefix="ngo" />
    </div>
  );
}

function PartnerFields() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField
          autoComplete="name"
          id="partner-full-name"
          label="Full name"
          maxLength={120}
          name="full_name"
          placeholder="Your name"
          required
        />
        <InputField
          autoComplete="tel"
          id="partner-phone"
          label="Phone"
          maxLength={40}
          name="phone"
          pattern="^\+?[0-9\s().-]{7,20}$"
          placeholder="+1 555 010 1234"
          required
          type="tel"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id="partner-vehicle-type"
          label="Vehicle type"
          name="vehicle_type"
          options={vehicleTypes}
          required
        />
        <InputField
          id="partner-vehicle-number"
          label="Vehicle number"
          maxLength={40}
          name="vehicle_number"
          placeholder="Registration or plate"
          required
        />
      </div>
    </div>
  );
}

function AddressFields({ prefix }: { prefix: "donor" | "ngo" }) {
  return (
    <>
      <InputField
        autoComplete="street-address"
        id={`${prefix}-address`}
        label="Address"
        maxLength={500}
        name="address"
        placeholder="Street address"
        required
      />
      <InputField
        autoComplete="address-level2"
        id={`${prefix}-city`}
        label="City"
        maxLength={120}
        name="city"
        placeholder="City"
        required
      />
    </>
  );
}
