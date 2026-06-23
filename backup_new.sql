--
-- PostgreSQL database dump
--

\restrict kH4sdSgYtVcYjrgWJmL4mL88NJsBxSE6Q9qFVnqh1BIdljhZYQABCDJ4sQaLDR8

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'issued',
    'paid',
    'cancelled'
);


ALTER TYPE public.invoice_status OWNER TO postgres;

--
-- Name: invoice_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invoice_type AS ENUM (
    'technician',
    'client',
    'admin'
);


ALTER TYPE public.invoice_type OWNER TO postgres;

--
-- Name: location_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.location_type AS ENUM (
    'governorate',
    'area',
    'neighborhood'
);


ALTER TYPE public.location_type OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'acknowledged',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'client',
    'technician'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    mobile character varying(20),
    password_hash character varying,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    profile_image_url character varying,
    is_super_admin boolean DEFAULT false NOT NULL,
    permissions jsonb,
    admin_role character varying(20) DEFAULT 'admin'::character varying NOT NULL
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- Name: availability_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability_audit_logs (
    id integer NOT NULL,
    technician_id character varying NOT NULL,
    changed_by_id character varying NOT NULL,
    changed_by_role character varying(20) NOT NULL,
    old_value boolean NOT NULL,
    new_value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.availability_audit_logs OWNER TO postgres;

--
-- Name: availability_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.availability_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.availability_audit_logs_id_seq OWNER TO postgres;

--
-- Name: availability_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.availability_audit_logs_id_seq OWNED BY public.availability_audit_logs.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_serial integer NOT NULL,
    order_id character varying,
    order_number character varying(100),
    client_id character varying,
    technician_id character varying,
    category character varying(100),
    subtotal numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT '14'::numeric NOT NULL,
    tax_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'EGP'::character varying NOT NULL,
    status public.invoice_status DEFAULT 'issued'::public.invoice_status NOT NULL,
    note_ar text,
    note_en text,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_type public.invoice_type,
    materials_photos jsonb,
    ocr_line_items jsonb,
    ocr_materials_total numeric(10,2),
    labour_fee numeric(10,2),
    transport_fee numeric(10,2),
    service_fee_rate numeric(5,2) DEFAULT 15,
    service_fee_amount numeric(10,2),
    vat_rate numeric(5,2) DEFAULT 14,
    vat_amount numeric(10,2),
    net_total numeric(10,2)
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: invoices_invoice_serial_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoices_invoice_serial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_invoice_serial_seq OWNER TO postgres;

--
-- Name: invoices_invoice_serial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoices_invoice_serial_seq OWNED BY public.invoices.invoice_serial;


--
-- Name: location_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_aliases (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    location_id character varying NOT NULL,
    alias character varying(300) NOT NULL,
    note character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.location_aliases OWNER TO postgres;

--
-- Name: location_miss_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_miss_log (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    suburb_en character varying(300),
    suburb_ar character varying(300),
    city_en character varying(300),
    city_ar character varying(300),
    lat character varying(50),
    lng character varying(50),
    seen_count integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.location_miss_log OWNER TO postgres;

--
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id character varying NOT NULL,
    type public.location_type NOT NULL,
    name_ar character varying(200) NOT NULL,
    name_en character varying(200) NOT NULL,
    parent_id character varying,
    slug character varying(200) NOT NULL,
    centroid public.geography(Point,4326)
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_logs (
    id integer NOT NULL,
    user_id character varying,
    identifier character varying NOT NULL,
    role character varying,
    success boolean NOT NULL,
    failure_reason character varying,
    ip_address character varying,
    user_agent character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.login_logs OWNER TO postgres;

--
-- Name: login_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.login_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_logs_id_seq OWNER TO postgres;

--
-- Name: login_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.login_logs_id_seq OWNED BY public.login_logs.id;


--
-- Name: nominatim_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nominatim_cache (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    cache_key character varying(500) NOT NULL,
    lang character varying(5) DEFAULT 'ar'::character varying NOT NULL,
    response_json jsonb NOT NULL,
    cached_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.nominatim_cache OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id character varying NOT NULL,
    order_number character varying NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp with time zone,
    order_serial integer NOT NULL,
    client_id character varying,
    technician_id character varying,
    category character varying(100),
    governorate character varying(100),
    area character varying(100),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    location public.geography(Point,4326),
    street character varying(200),
    building_no character varying(50),
    floor_no character varying(50),
    apt_no character varying(50),
    scheduled_at timestamp with time zone,
    client_rating smallint,
    tech_rating smallint,
    specialty_id character varying,
    CONSTRAINT orders_client_rating_check CHECK (((client_rating >= 1) AND (client_rating <= 5))),
    CONSTRAINT orders_tech_rating_check CHECK (((tech_rating >= 1) AND (tech_rating <= 5)))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_order_serial_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_order_serial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_order_serial_seq OWNER TO postgres;

--
-- Name: orders_order_serial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_order_serial_seq OWNED BY public.orders.order_serial;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    token_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: phone_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.phone_verifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    mobile character varying(20) NOT NULL,
    code_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.phone_verifications OWNER TO postgres;

--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    id bigint NOT NULL,
    key text NOT NULL,
    hit_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rate_limits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rate_limits_id_seq OWNER TO postgres;

--
-- Name: rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rate_limits_id_seq OWNED BY public.rate_limits.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_migrations (
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO postgres;

--
-- Name: service_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_domains (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name_en character varying(100) DEFAULT ''::character varying NOT NULL,
    name_ar character varying(100) NOT NULL,
    icon character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.service_domains OWNER TO postgres;

--
-- Name: service_specializations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_specializations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    domain_id character varying NOT NULL,
    name_en character varying(100) NOT NULL,
    name_ar character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.service_specializations OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: technician_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.technician_notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    technician_id character varying NOT NULL,
    type character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.technician_notifications OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    role public.user_role,
    mobile character varying(20),
    governorate character varying(100),
    area character varying(100),
    district character varying(100),
    profession character varying(100),
    specialty character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    password_hash character varying,
    is_active boolean DEFAULT true NOT NULL,
    location public.geography(Point,4326),
    service_categories jsonb,
    address character varying(500),
    service_start character varying(5),
    service_end character varying(5),
    expo_push_token character varying,
    street character varying(200),
    building_no character varying(50),
    floor_no character varying(50),
    apt_no character varying(50),
    national_id character varying(14),
    national_id_front_url text,
    national_id_back_url text,
    license_card_url text,
    is_approved boolean DEFAULT false NOT NULL,
    bio text,
    years_of_experience integer,
    rating numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: availability_audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.availability_audit_logs_id_seq'::regclass);


--
-- Name: invoices invoice_serial; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices ALTER COLUMN invoice_serial SET DEFAULT nextval('public.invoices_invoice_serial_seq'::regclass);


--
-- Name: login_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs ALTER COLUMN id SET DEFAULT nextval('public.login_logs_id_seq'::regclass);


--
-- Name: orders order_serial; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_serial SET DEFAULT nextval('public.orders_order_serial_seq'::regclass);


--
-- Name: rate_limits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits ALTER COLUMN id SET DEFAULT nextval('public.rate_limits_id_seq'::regclass);


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.admins VALUES ('08588777-1bec-43f1-a3f7-7b0ff70faf79', 'fanni@fanni.com', 'Admin2', NULL, '01001001001', '4cfcdc6af4cf4d9c1cbf6563b3377234:4dfb17e162bf2a3af1a34713582870657bc6877a26277c735ea4265bbd7893108b06a48a1061272a097aac0c31cedd4cd27cfa041e3fc9e33547193895011bd8', true, '2026-04-29 13:26:10.942309+00', '2026-04-29 13:26:10.942309+00', false, NULL, false, NULL, 'admin');
INSERT INTO public.admins VALUES ('f9196714-78a9-45bc-9457-20091ad18675', 'admin@fanni.app', 'Admin', NULL, 'admin', '4eafd5900a6099740105d32f6befc68c:5525aed34f63a157b23b859ceeeeb7d725136f8d1aacb90f3a0abd62a9f4b0d0f3066112367e149c095e2ff2303772db7670223a6f8f5ddc12e202d30048ef20', true, '2026-04-23 00:27:08.006+00', '2026-04-25 20:17:18.39+00', true, NULL, true, NULL, 'super_admin');


--
-- Data for Name: availability_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.availability_audit_logs VALUES (1, '1d2b4810-c915-4b5e-acb4-be1b2ecd583f', '1d2b4810-c915-4b5e-acb4-be1b2ecd583f', 'technician', true, false, '2026-04-29 13:43:16.043293+00');
INSERT INTO public.availability_audit_logs VALUES (2, '1d2b4810-c915-4b5e-acb4-be1b2ecd583f', '1d2b4810-c915-4b5e-acb4-be1b2ecd583f', 'technician', false, true, '2026-04-29 13:43:18.348949+00');
INSERT INTO public.availability_audit_logs VALUES (3, '17566df4-08e4-4965-a0df-2baf6e90149f', '17566df4-08e4-4965-a0df-2baf6e90149f', 'technician', true, false, '2026-05-31 18:14:34.629525+00');
INSERT INTO public.availability_audit_logs VALUES (4, '17566df4-08e4-4965-a0df-2baf6e90149f', '17566df4-08e4-4965-a0df-2baf6e90149f', 'technician', false, true, '2026-05-31 18:14:40.093657+00');


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: location_aliases; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: location_miss_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.locations VALUES ('giza__atfih', 'area', 'أطفيح', 'Atfih', 'giza', 'giza__atfih', NULL);
INSERT INTO public.locations VALUES ('menofia', 'governorate', 'المنوفية', 'Menofia', NULL, 'menofia', NULL);
INSERT INTO public.locations VALUES ('assiut__sahel_selim', 'area', 'ساحل سليم', 'Sahel Selim', 'assiut', 'assiut__sahel_selim', NULL);
INSERT INTO public.locations VALUES ('port_said__almanakh', 'area', 'حى المناخ', 'Almanakh', 'port_said', 'port_said__almanakh', NULL);
INSERT INTO public.locations VALUES ('damietta__alsaru', 'area', 'السرو', 'alsaru', 'damietta', 'damietta__alsaru', NULL);
INSERT INTO public.locations VALUES ('damietta__kafr_elbatikh', 'area', 'كفر البطيخ', 'Kafr El-Batikh', 'damietta', 'damietta__kafr_elbatikh', NULL);
INSERT INTO public.locations VALUES ('damietta__azbet_al_burg', 'area', 'عزبة البرج', 'Azbet Al Burg', 'damietta', 'damietta__azbet_al_burg', NULL);
INSERT INTO public.locations VALUES ('damietta__meet_abou_ghalib', 'area', 'ميت أبو غالب', 'Meet Abou Ghalib', 'damietta', 'damietta__meet_abou_ghalib', NULL);
INSERT INTO public.locations VALUES ('sharkia__al_ibrahimiyah', 'area', 'الإبراهيمية', 'Al Ibrahimiyah', 'sharkia', 'sharkia__al_ibrahimiyah', NULL);
INSERT INTO public.locations VALUES ('sharkia__deirb_negm', 'area', 'ديرب نجم', 'Deirb Negm', 'sharkia', 'sharkia__deirb_negm', NULL);
INSERT INTO public.locations VALUES ('sharkia__kafr_saqr', 'area', 'كفر صقر', 'Kafr Saqr', 'sharkia', 'sharkia__kafr_saqr', NULL);
INSERT INTO public.locations VALUES ('south_sinai__al_toor', 'area', 'الطور', 'Al Toor', 'south_sinai', 'south_sinai__al_toor', NULL);
INSERT INTO public.locations VALUES ('south_sinai__sharm_elshaikh', 'area', 'شرم الشيخ', 'Sharm El-Shaikh', 'south_sinai', 'south_sinai__sharm_elshaikh', NULL);
INSERT INTO public.locations VALUES ('south_sinai__dahab', 'area', 'دهب', 'Dahab', 'south_sinai', 'south_sinai__dahab', NULL);
INSERT INTO public.locations VALUES ('south_sinai__nuweiba', 'area', 'نويبع', 'Nuweiba', 'south_sinai', 'south_sinai__nuweiba', NULL);
INSERT INTO public.locations VALUES ('south_sinai__taba', 'area', 'طابا', 'Taba', 'south_sinai', 'south_sinai__taba', NULL);
INSERT INTO public.locations VALUES ('south_sinai__saint_catherine', 'area', 'سانت كاترين', 'Saint Catherine', 'south_sinai', 'south_sinai__saint_catherine', NULL);
INSERT INTO public.locations VALUES ('cairo', 'governorate', 'القاهرة', 'Cairo', NULL, 'cairo', NULL);
INSERT INTO public.locations VALUES ('cairo__shubra', 'area', 'شبرا', 'Shubra', 'cairo', 'cairo__shubra', NULL);
INSERT INTO public.locations VALUES ('cairo__tura', 'area', 'طره', 'Tura', 'cairo', 'cairo__tura', NULL);
INSERT INTO public.locations VALUES ('cairo__ain_shams', 'area', 'عين شمس', 'Ain Shams', 'cairo', 'cairo__ain_shams', NULL);
INSERT INTO public.locations VALUES ('cairo__badr_city', 'area', 'مدينة بدر', 'Badr City', 'cairo', 'cairo__badr_city', NULL);
INSERT INTO public.locations VALUES ('cairo__zamalek', 'area', 'الزمالك', 'Zamalek', 'cairo', 'cairo__zamalek', NULL);
INSERT INTO public.locations VALUES ('cairo__rehab', 'area', 'الرحاب', 'Rehab', 'cairo', 'cairo__rehab', NULL);
INSERT INTO public.locations VALUES ('cairo__10th_of_ramadan_city', 'area', 'العاشر من رمضان', '10th of Ramadan City', 'cairo', 'cairo__10th_of_ramadan_city', NULL);
INSERT INTO public.locations VALUES ('cairo__new_nozha', 'area', 'النزهة الجديدة', 'New Nozha', 'cairo', 'cairo__new_nozha', NULL);
INSERT INTO public.locations VALUES ('giza', 'governorate', 'الجيزة', 'Giza', NULL, 'giza', NULL);
INSERT INTO public.locations VALUES ('giza__giza', 'area', 'الجيزة', 'Giza', 'giza', 'giza__giza', NULL);
INSERT INTO public.locations VALUES ('giza__cheikh_zayed', 'area', 'الشيخ زايد', 'Cheikh Zayed', 'giza', 'giza__cheikh_zayed', NULL);
INSERT INTO public.locations VALUES ('beni_suef__fashn', 'area', 'الفشن', 'Fashn', 'beni_suef', 'beni_suef__fashn', NULL);
INSERT INTO public.locations VALUES ('port_said__port_fouad', 'area', 'بورفؤاد', 'Port Fouad', 'port_said', 'port_said__port_fouad', NULL);
INSERT INTO public.locations VALUES ('port_said__alarab', 'area', 'العرب', 'Alarab', 'port_said', 'port_said__alarab', NULL);
INSERT INTO public.locations VALUES ('port_said__zohour', 'area', 'حى الزهور', 'Zohour', 'port_said', 'port_said__zohour', NULL);
INSERT INTO public.locations VALUES ('port_said__alsharq', 'area', 'حى الشرق', 'Alsharq', 'port_said', 'port_said__alsharq', NULL);
INSERT INTO public.locations VALUES ('port_said__mubarak', 'area', 'حى مبارك', 'Mubarak', 'port_said', 'port_said__mubarak', NULL);
INSERT INTO public.locations VALUES ('damietta', 'governorate', 'دمياط', 'Damietta', NULL, 'damietta', NULL);
INSERT INTO public.locations VALUES ('damietta__damietta', 'area', 'دمياط', 'Damietta', 'damietta', 'damietta__damietta', NULL);
INSERT INTO public.locations VALUES ('damietta__new_damietta', 'area', 'دمياط الجديدة', 'New Damietta', 'damietta', 'damietta__new_damietta', NULL);
INSERT INTO public.locations VALUES ('damietta__ras_el_bar', 'area', 'رأس البر', 'Ras El Bar', 'damietta', 'damietta__ras_el_bar', NULL);
INSERT INTO public.locations VALUES ('damietta__faraskour', 'area', 'فارسكور', 'Faraskour', 'damietta', 'damietta__faraskour', NULL);
INSERT INTO public.locations VALUES ('damietta__zarqa', 'area', 'الزرقا', 'Zarqa', 'damietta', 'damietta__zarqa', NULL);
INSERT INTO public.locations VALUES ('south_sinai__abu_redis', 'area', 'أبو رديس', 'Abu Redis', 'south_sinai', 'south_sinai__abu_redis', NULL);
INSERT INTO public.locations VALUES ('south_sinai__abu_zenaima', 'area', 'أبو زنيمة', 'Abu Zenaima', 'south_sinai', 'south_sinai__abu_zenaima', NULL);
INSERT INTO public.locations VALUES ('south_sinai__ras_sidr', 'area', 'رأس سدر', 'Ras Sidr', 'south_sinai', 'south_sinai__ras_sidr', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh', 'governorate', 'كفر الشيخ', 'Kafr Al sheikh', NULL, 'kafr_al_sheikh', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__kafr_el_sheikh', 'area', 'كفر الشيخ', 'Kafr El Sheikh', 'kafr_al_sheikh', 'kafr_al_sheikh__kafr_el_sheikh', NULL);
INSERT INTO public.locations VALUES ('luxor', 'governorate', 'الأقصر', 'Luxor', NULL, 'luxor', NULL);
INSERT INTO public.locations VALUES ('luxor__luxor', 'area', 'الأقصر', 'Luxor', 'luxor', 'luxor__luxor', NULL);
INSERT INTO public.locations VALUES ('luxor__al_ziynia', 'area', 'الزينية', 'Al ziynia', 'luxor', 'luxor__al_ziynia', NULL);
INSERT INTO public.locations VALUES ('luxor__al_bayadieh', 'area', 'البياضية', 'Al Bayadieh', 'luxor', 'luxor__al_bayadieh', NULL);
INSERT INTO public.locations VALUES ('sohag', 'governorate', 'سوهاج', 'Sohag', NULL, 'sohag', NULL);
INSERT INTO public.locations VALUES ('cairo__nasr_city', 'area', 'مدينة نصر', 'Nasr City', 'cairo', 'cairo__nasr_city', NULL);
INSERT INTO public.locations VALUES ('cairo__masr_al_qadima', 'area', 'مصر القديمة', 'Masr Al Qadima', 'cairo', 'cairo__masr_al_qadima', NULL);
INSERT INTO public.locations VALUES ('cairo__cairo_downtown', 'area', 'وسط البلد', 'Cairo Downtown', 'cairo', 'cairo__cairo_downtown', NULL);
INSERT INTO public.locations VALUES ('cairo__madinty', 'area', 'مدينتي', 'Madinty', 'cairo', 'cairo__madinty', NULL);
INSERT INTO public.locations VALUES ('cairo__sheraton', 'area', 'شيراتون', 'Sheraton', 'cairo', 'cairo__sheraton', NULL);
INSERT INTO public.locations VALUES ('cairo__elgamaleya', 'area', 'الجمالية', 'El-Gamaleya', 'cairo', 'cairo__elgamaleya', NULL);
INSERT INTO public.locations VALUES ('dakahlia__mansoura', 'area', 'المنصورة', 'Mansoura', 'dakahlia', 'dakahlia__mansoura', NULL);
INSERT INTO public.locations VALUES ('beni_suef__al_wasta', 'area', 'الواسطى', 'Al Wasta', 'beni_suef', 'beni_suef__al_wasta', NULL);
INSERT INTO public.locations VALUES ('cairo__15_may', 'area', '15 مايو', '15 May', 'cairo', 'cairo__15_may', NULL);
INSERT INTO public.locations VALUES ('cairo__al_azbakeyah', 'area', 'الازبكية', 'Al Azbakeyah', 'cairo', 'cairo__al_azbakeyah', NULL);
INSERT INTO public.locations VALUES ('cairo__al_basatin', 'area', 'البساتين', 'Al Basatin', 'cairo', 'cairo__al_basatin', NULL);
INSERT INTO public.locations VALUES ('cairo__tebin', 'area', 'التبين', 'Tebin', 'cairo', 'cairo__tebin', NULL);
INSERT INTO public.locations VALUES ('cairo__elkhalifa', 'area', 'الخليفة', 'El-Khalifa', 'cairo', 'cairo__elkhalifa', NULL);
INSERT INTO public.locations VALUES ('cairo__el_darrasa', 'area', 'الدراسة', 'El darrasa', 'cairo', 'cairo__el_darrasa', NULL);
INSERT INTO public.locations VALUES ('cairo__aldarb_alahmar', 'area', 'الدرب الاحمر', 'Aldarb Alahmar', 'cairo', 'cairo__aldarb_alahmar', NULL);
INSERT INTO public.locations VALUES ('cairo__zawya_alhamra', 'area', 'الزاوية الحمراء', 'Zawya al-Hamra', 'cairo', 'cairo__zawya_alhamra', NULL);
INSERT INTO public.locations VALUES ('cairo__elzaytoun', 'area', 'الزيتون', 'El-Zaytoun', 'cairo', 'cairo__elzaytoun', NULL);
INSERT INTO public.locations VALUES ('cairo__sahel', 'area', 'الساحل', 'Sahel', 'cairo', 'cairo__sahel', NULL);
INSERT INTO public.locations VALUES ('cairo__el_salam', 'area', 'السلام', 'El Salam', 'cairo', 'cairo__el_salam', NULL);
INSERT INTO public.locations VALUES ('cairo__sayeda_zeinab', 'area', 'السيدة زينب', 'Sayeda Zeinab', 'cairo', 'cairo__sayeda_zeinab', NULL);
INSERT INTO public.locations VALUES ('cairo__el_sharabeya', 'area', 'الشرابية', 'El Sharabeya', 'cairo', 'cairo__el_sharabeya', NULL);
INSERT INTO public.locations VALUES ('cairo__shorouk', 'area', 'مدينة الشروق', 'Shorouk', 'cairo', 'cairo__shorouk', NULL);
INSERT INTO public.locations VALUES ('cairo__el_daher', 'area', 'الظاهر', 'El Daher', 'cairo', 'cairo__el_daher', NULL);
INSERT INTO public.locations VALUES ('cairo__ataba', 'area', 'العتبة', 'Ataba', 'cairo', 'cairo__ataba', NULL);
INSERT INTO public.locations VALUES ('cairo__new_cairo', 'area', 'القاهرة الجديدة', 'New Cairo', 'cairo', 'cairo__new_cairo', NULL);
INSERT INTO public.locations VALUES ('cairo__el_marg', 'area', 'المرج', 'El Marg', 'cairo', 'cairo__el_marg', NULL);
INSERT INTO public.locations VALUES ('cairo__ezbet_el_nakhl', 'area', 'عزبة النخل', 'Ezbet el Nakhl', 'cairo', 'cairo__ezbet_el_nakhl', NULL);
INSERT INTO public.locations VALUES ('cairo__matareya', 'area', 'المطرية', 'Matareya', 'cairo', 'cairo__matareya', NULL);
INSERT INTO public.locations VALUES ('cairo__maadi', 'area', 'المعادى', 'Maadi', 'cairo', 'cairo__maadi', NULL);
INSERT INTO public.locations VALUES ('cairo__maasara', 'area', 'المعصرة', 'Maasara', 'cairo', 'cairo__maasara', NULL);
INSERT INTO public.locations VALUES ('cairo__mokattam', 'area', 'المقطم', 'Mokattam', 'cairo', 'cairo__mokattam', NULL);
INSERT INTO public.locations VALUES ('cairo__manyal', 'area', 'المنيل', 'Manyal', 'cairo', 'cairo__manyal', NULL);
INSERT INTO public.locations VALUES ('cairo__mosky', 'area', 'الموسكى', 'Mosky', 'cairo', 'cairo__mosky', NULL);
INSERT INTO public.locations VALUES ('cairo__nozha', 'area', 'النزهة', 'Nozha', 'cairo', 'cairo__nozha', NULL);
INSERT INTO public.locations VALUES ('cairo__waily', 'area', 'الوايلى', 'Waily', 'cairo', 'cairo__waily', NULL);
INSERT INTO public.locations VALUES ('cairo__bab_alshereia', 'area', 'باب الشعرية', 'Bab al-Shereia', 'cairo', 'cairo__bab_alshereia', NULL);
INSERT INTO public.locations VALUES ('cairo__bolaq', 'area', 'بولاق', 'Bolaq', 'cairo', 'cairo__bolaq', NULL);
INSERT INTO public.locations VALUES ('cairo__garden_city', 'area', 'جاردن سيتى', 'Garden City', 'cairo', 'cairo__garden_city', NULL);
INSERT INTO public.locations VALUES ('cairo__helwan', 'area', 'حلوان', 'Helwan', 'cairo', 'cairo__helwan', NULL);
INSERT INTO public.locations VALUES ('cairo__abaseya', 'area', 'عباسية', 'Abaseya', 'cairo', 'cairo__abaseya', NULL);
INSERT INTO public.locations VALUES ('cairo__mansheya_nasir', 'area', 'منشية ناصر', 'Mansheya Nasir', 'cairo', 'cairo__mansheya_nasir', NULL);
INSERT INTO public.locations VALUES ('cairo__katameya', 'area', 'القطامية', 'Katameya', 'cairo', 'cairo__katameya', NULL);
INSERT INTO public.locations VALUES ('fayoum', 'governorate', 'الفيوم', 'Fayoum', NULL, 'fayoum', NULL);
INSERT INTO public.locations VALUES ('minya__mattay', 'area', 'مطاي', 'Mattay', 'minya', 'minya__mattay', NULL);
INSERT INTO public.locations VALUES ('suez', 'governorate', 'السويس', 'Suez', NULL, 'suez', NULL);
INSERT INTO public.locations VALUES ('aswan__kalabsha', 'area', 'كلابشة', 'Kalabsha', 'aswan', 'aswan__kalabsha', NULL);
INSERT INTO public.locations VALUES ('aswan__edfu', 'area', 'إدفو', 'Edfu', 'aswan', 'aswan__edfu', NULL);
INSERT INTO public.locations VALUES ('aswan__alradisiyah', 'area', 'الرديسية', 'Al-Radisiyah', 'aswan', 'aswan__alradisiyah', NULL);
INSERT INTO public.locations VALUES ('sohag__jahina_al_gharbia', 'area', 'جهينة الغربية', 'Jahina Al Gharbia', 'sohag', 'sohag__jahina_al_gharbia', NULL);
INSERT INTO public.locations VALUES ('sohag__saqilatuh', 'area', 'ساقلته', 'Saqilatuh', 'sohag', 'sohag__saqilatuh', NULL);
INSERT INTO public.locations VALUES ('sohag__tama', 'area', 'طما', 'Tama', 'sohag', 'sohag__tama', NULL);
INSERT INTO public.locations VALUES ('sohag__tahta', 'area', 'طهطا', 'Tahta', 'sohag', 'sohag__tahta', NULL);
INSERT INTO public.locations VALUES ('cairo__hadayek_elkobba', 'area', 'حدائق القبة', 'Hadayek El-Kobba', 'cairo', 'cairo__hadayek_elkobba', NULL);
INSERT INTO public.locations VALUES ('cairo__dar_al_salam', 'area', 'دار السلام', 'Dar Al Salam', 'cairo', 'cairo__dar_al_salam', NULL);
INSERT INTO public.locations VALUES ('cairo__abdeen', 'area', 'عابدين', 'Abdeen', 'cairo', 'cairo__abdeen', NULL);
INSERT INTO public.locations VALUES ('cairo__new_heliopolis', 'area', 'مصر الجديدة', 'New Heliopolis', 'cairo', 'cairo__new_heliopolis', NULL);
INSERT INTO public.locations VALUES ('cairo__obour_city', 'area', 'مدينة العبور', 'Obour City', 'cairo', 'cairo__obour_city', NULL);
INSERT INTO public.locations VALUES ('cairo__kasr_el_nile', 'area', 'قصر النيل', 'Kasr El Nile', 'cairo', 'cairo__kasr_el_nile', NULL);
INSERT INTO public.locations VALUES ('cairo__rod_alfarag', 'area', 'روض الفرج', 'Rod Alfarag', 'cairo', 'cairo__rod_alfarag', NULL);
INSERT INTO public.locations VALUES ('cairo__helmeyat_alzaytoun', 'area', 'الحلمية', 'Helmeyat Alzaytoun', 'cairo', 'cairo__helmeyat_alzaytoun', NULL);
INSERT INTO public.locations VALUES ('cairo__capital_new', 'area', 'العاصمة الإدارية', 'Capital New', 'cairo', 'cairo__capital_new', NULL);
INSERT INTO public.locations VALUES ('giza__sixth_of_october', 'area', 'السادس من أكتوبر', 'Sixth of October', 'giza', 'giza__sixth_of_october', NULL);
INSERT INTO public.locations VALUES ('giza__hawamdiyah', 'area', 'الحوامدية', 'Hawamdiyah', 'giza', 'giza__hawamdiyah', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__kafr_el_sheikh_downtown', 'area', 'وسط البلد كفر الشيخ', 'Kafr El Sheikh Downtown', 'kafr_al_sheikh', 'kafr_al_sheikh__kafr_el_sheikh_downtown', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__desouq', 'area', 'دسوق', 'Desouq', 'kafr_al_sheikh', 'kafr_al_sheikh__desouq', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__baltim', 'area', 'بلطيم', 'Baltim', 'kafr_al_sheikh', 'kafr_al_sheikh__baltim', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__masief_baltim', 'area', 'مصيف بلطيم', 'Masief Baltim', 'kafr_al_sheikh', 'kafr_al_sheikh__masief_baltim', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__hamol', 'area', 'الحامول', 'Hamol', 'kafr_al_sheikh', 'kafr_al_sheikh__hamol', NULL);
INSERT INTO public.locations VALUES ('sohag__dar_aisalaam', 'area', 'دار السلام', 'Dar AISalaam', 'sohag', 'sohag__dar_aisalaam', NULL);
INSERT INTO public.locations VALUES ('sohag__gerga', 'area', 'جرجا', 'Gerga', 'sohag', 'sohag__gerga', NULL);
INSERT INTO public.locations VALUES ('luxor__al_tud', 'area', 'الطود', 'Al Tud', 'luxor', 'luxor__al_tud', NULL);
INSERT INTO public.locations VALUES ('qena', 'governorate', 'قنا', 'Qena', NULL, 'qena', NULL);
INSERT INTO public.locations VALUES ('qena__qena', 'area', 'قنا', 'Qena', 'qena', 'qena__qena', NULL);
INSERT INTO public.locations VALUES ('qena__new_qena', 'area', 'قنا الجديدة', 'New Qena', 'qena', 'qena__new_qena', NULL);
INSERT INTO public.locations VALUES ('qena__abu_tesht', 'area', 'ابو طشت', 'Abu Tesht', 'qena', 'qena__abu_tesht', NULL);
INSERT INTO public.locations VALUES ('alexandria__mansheya', 'area', 'المنشية', 'Mansheya', 'alexandria', 'alexandria__mansheya', NULL);
INSERT INTO public.locations VALUES ('alexandria__ambrozo', 'area', 'امبروزو', 'Ambrozo', 'alexandria', 'alexandria__ambrozo', NULL);
INSERT INTO public.locations VALUES ('alexandria__bab_sharq', 'area', 'باب شرق', 'Bab Sharq', 'alexandria', 'alexandria__bab_sharq', NULL);
INSERT INTO public.locations VALUES ('alexandria__fleming', 'area', 'فلمينج', 'Fleming', 'alexandria', 'alexandria__fleming', NULL);
INSERT INTO public.locations VALUES ('alexandria__karmooz', 'area', 'كرموز', 'Karmooz', 'alexandria', 'alexandria__karmooz', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__fooh', 'area', 'فوه', 'Fooh', 'kafr_al_sheikh', 'kafr_al_sheikh__fooh', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__metobas', 'area', 'مطوبس', 'Metobas', 'kafr_al_sheikh', 'kafr_al_sheikh__metobas', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__burg_al_burullus', 'area', 'برج البرلس', 'Burg Al Burullus', 'kafr_al_sheikh', 'kafr_al_sheikh__burg_al_burullus', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__riyadh', 'area', 'الرياض', 'Riyadh', 'kafr_al_sheikh', 'kafr_al_sheikh__riyadh', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__sidi_salm', 'area', 'سيدي سالم', 'Sidi Salm', 'kafr_al_sheikh', 'kafr_al_sheikh__sidi_salm', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__qellen', 'area', 'قلين', 'Qellen', 'kafr_al_sheikh', 'kafr_al_sheikh__qellen', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__sidi_ghazi', 'area', 'سيدي غازي', 'Sidi Ghazi', 'kafr_al_sheikh', 'kafr_al_sheikh__sidi_ghazi', NULL);
INSERT INTO public.locations VALUES ('matrouh__dabaa', 'area', 'الضبعة', 'Dabaa', 'matrouh', 'matrouh__dabaa', NULL);
INSERT INTO public.locations VALUES ('matrouh__alnagila', 'area', 'النجيلة', 'Al-Nagila', 'matrouh', 'matrouh__alnagila', NULL);
INSERT INTO public.locations VALUES ('matrouh__sidi_brani', 'area', 'سيدي براني', 'Sidi Brani', 'matrouh', 'matrouh__sidi_brani', NULL);
INSERT INTO public.locations VALUES ('matrouh__salloum', 'area', 'السلوم', 'Salloum', 'matrouh', 'matrouh__salloum', NULL);
INSERT INTO public.locations VALUES ('luxor__new_luxor', 'area', 'الأقصر الجديدة', 'New Luxor', 'luxor', 'luxor__new_luxor', NULL);
INSERT INTO public.locations VALUES ('luxor__esna', 'area', 'إسنا', 'Esna', 'luxor', 'luxor__esna', NULL);
INSERT INTO public.locations VALUES ('luxor__new_tiba', 'area', 'طيبة الجديدة', 'New Tiba', 'luxor', 'luxor__new_tiba', NULL);
INSERT INTO public.locations VALUES ('beheira__mahmoudiyah', 'area', 'المحمودية', 'Mahmoudiyah', 'beheira', 'beheira__mahmoudiyah', NULL);
INSERT INTO public.locations VALUES ('beheira__rahmaniyah', 'area', 'الرحمانية', 'Rahmaniyah', 'beheira', 'beheira__rahmaniyah', NULL);
INSERT INTO public.locations VALUES ('beheira__shubrakhit', 'area', 'شبراخيت', 'Shubrakhit', 'beheira', 'beheira__shubrakhit', NULL);
INSERT INTO public.locations VALUES ('beheira__kom_hamada', 'area', 'كوم حمادة', 'Kom Hamada', 'beheira', 'beheira__kom_hamada', NULL);
INSERT INTO public.locations VALUES ('beheira__wadi_natrun', 'area', 'وادي النطرون', 'Wadi Natrun', 'beheira', 'beheira__wadi_natrun', NULL);
INSERT INTO public.locations VALUES ('beheira__new_nubaria', 'area', 'النوبارية الجديدة', 'New Nubaria', 'beheira', 'beheira__new_nubaria', NULL);
INSERT INTO public.locations VALUES ('beheira__alnoubareya', 'area', 'النوبارية', 'Alnoubareya', 'beheira', 'beheira__alnoubareya', NULL);
INSERT INTO public.locations VALUES ('fayoum__fayoum', 'area', 'الفيوم', 'Fayoum', 'fayoum', 'fayoum__fayoum', NULL);
INSERT INTO public.locations VALUES ('fayoum__tamiya', 'area', 'طامية', 'Tamiya', 'fayoum', 'fayoum__tamiya', NULL);
INSERT INTO public.locations VALUES ('fayoum__snores', 'area', 'سنورس', 'Snores', 'fayoum', 'fayoum__snores', NULL);
INSERT INTO public.locations VALUES ('fayoum__etsa', 'area', 'إطسا', 'Etsa', 'fayoum', 'fayoum__etsa', NULL);
INSERT INTO public.locations VALUES ('fayoum__epschway', 'area', 'إبشواي', 'Epschway', 'fayoum', 'fayoum__epschway', NULL);
INSERT INTO public.locations VALUES ('fayoum__yusuf_el_sediaq', 'area', 'يوسف الصديق', 'Yusuf El Sediaq', 'fayoum', 'fayoum__yusuf_el_sediaq', NULL);
INSERT INTO public.locations VALUES ('fayoum__hadqa', 'area', 'الحادقة', 'Hadqa', 'fayoum', 'fayoum__hadqa', NULL);
INSERT INTO public.locations VALUES ('fayoum__atsa', 'area', 'اطسا', 'Atsa', 'fayoum', 'fayoum__atsa', NULL);
INSERT INTO public.locations VALUES ('fayoum__algamaa', 'area', 'الجامعة', 'Algamaa', 'fayoum', 'fayoum__algamaa', NULL);
INSERT INTO public.locations VALUES ('minya__minya', 'area', 'المنيا', 'Minya', 'minya', 'minya__minya', NULL);
INSERT INTO public.locations VALUES ('minya__minya_el_gedida', 'area', 'المنيا الجديدة', 'Minya El Gedida', 'minya', 'minya__minya_el_gedida', NULL);
INSERT INTO public.locations VALUES ('assiut__el_badari', 'area', 'البداري', 'El Badari', 'assiut', 'assiut__el_badari', NULL);
INSERT INTO public.locations VALUES ('assiut__sidfa', 'area', 'صدفا', 'Sidfa', 'assiut', 'assiut__sidfa', NULL);
INSERT INTO public.locations VALUES ('beni_suef__bani_sweif', 'area', 'بني سويف', 'Bani Sweif', 'beni_suef', 'beni_suef__bani_sweif', NULL);
INSERT INTO public.locations VALUES ('beni_suef__beni_suef_el_gedida', 'area', 'بني سويف الجديدة', 'Beni Suef El Gedida', 'beni_suef', 'beni_suef__beni_suef_el_gedida', NULL);
INSERT INTO public.locations VALUES ('beni_suef__naser', 'area', 'ناصر', 'Naser', 'beni_suef', 'beni_suef__naser', NULL);
INSERT INTO public.locations VALUES ('beni_suef__ehnasia', 'area', 'إهناسيا', 'Ehnasia', 'beni_suef', 'beni_suef__ehnasia', NULL);
INSERT INTO public.locations VALUES ('beni_suef__beba', 'area', 'ببا', 'beba', 'beni_suef', 'beni_suef__beba', NULL);
INSERT INTO public.locations VALUES ('beni_suef__somasta', 'area', 'سمسطا', 'Somasta', 'beni_suef', 'beni_suef__somasta', NULL);
INSERT INTO public.locations VALUES ('beni_suef__alabbaseri', 'area', 'الاباصيرى', 'Alabbaseri', 'beni_suef', 'beni_suef__alabbaseri', NULL);
INSERT INTO public.locations VALUES ('beni_suef__mokbel', 'area', 'مقبل', 'Mokbel', 'beni_suef', 'beni_suef__mokbel', NULL);
INSERT INTO public.locations VALUES ('port_said', 'governorate', 'بورسعيد', 'Port Said', NULL, 'port_said', NULL);
INSERT INTO public.locations VALUES ('port_said__porsaid', 'area', 'بورسعيد', 'PorSaid', 'port_said', 'port_said__porsaid', NULL);
INSERT INTO public.locations VALUES ('port_said__aldawahi', 'area', 'حى الضواحى', 'Aldawahi', 'port_said', 'port_said__aldawahi', NULL);
INSERT INTO public.locations VALUES ('damietta__alruwda', 'area', 'الروضة', 'alruwda', 'damietta', 'damietta__alruwda', NULL);
INSERT INTO public.locations VALUES ('sharkia', 'governorate', 'الشرقية', 'Sharkia', NULL, 'sharkia', NULL);
INSERT INTO public.locations VALUES ('sharkia__hehia', 'area', 'ههيا', 'Hehia', 'sharkia', 'sharkia__hehia', NULL);
INSERT INTO public.locations VALUES ('sohag__alkawthar', 'area', 'الكوثر', 'Alkawthar', 'sohag', 'sohag__alkawthar', NULL);
INSERT INTO public.locations VALUES ('giza__al_badrasheen', 'area', 'البدرشين', 'Al Badrasheen', 'giza', 'giza__al_badrasheen', NULL);
INSERT INTO public.locations VALUES ('giza__saf', 'area', 'الصف', 'Saf', 'giza', 'giza__saf', NULL);
INSERT INTO public.locations VALUES ('giza__al_ayat', 'area', 'العياط', 'Al Ayat', 'giza', 'giza__al_ayat', NULL);
INSERT INTO public.locations VALUES ('giza__albawaiti', 'area', 'الباويطي', 'Al-Bawaiti', 'giza', 'giza__albawaiti', NULL);
INSERT INTO public.locations VALUES ('giza__manshiyetal_qanater', 'area', 'منشأة القناطر', 'ManshiyetAl Qanater', 'giza', 'giza__manshiyetal_qanater', NULL);
INSERT INTO public.locations VALUES ('giza__oaseem', 'area', 'أوسيم', 'Oaseem', 'giza', 'giza__oaseem', NULL);
INSERT INTO public.locations VALUES ('giza__kerdasa', 'area', 'كرداسة', 'Kerdasa', 'giza', 'giza__kerdasa', NULL);
INSERT INTO public.locations VALUES ('giza__abu_nomros', 'area', 'أبو النمرس', 'Abu Nomros', 'giza', 'giza__abu_nomros', NULL);
INSERT INTO public.locations VALUES ('giza__kafr_ghati', 'area', 'كفر غطاطي', 'Kafr Ghati', 'giza', 'giza__kafr_ghati', NULL);
INSERT INTO public.locations VALUES ('giza__manshiyet_al_bakari', 'area', 'منشأة البكاري', 'Manshiyet Al Bakari', 'giza', 'giza__manshiyet_al_bakari', NULL);
INSERT INTO public.locations VALUES ('giza__dokki', 'area', 'الدقى', 'Dokki', 'giza', 'giza__dokki', NULL);
INSERT INTO public.locations VALUES ('giza__agouza', 'area', 'العجوزة', 'Agouza', 'giza', 'giza__agouza', NULL);
INSERT INTO public.locations VALUES ('giza__haram', 'area', 'الهرم', 'Haram', 'giza', 'giza__haram', NULL);
INSERT INTO public.locations VALUES ('giza__warraq', 'area', 'الوراق', 'Warraq', 'giza', 'giza__warraq', NULL);
INSERT INTO public.locations VALUES ('giza__imbaba', 'area', 'امبابة', 'Imbaba', 'giza', 'giza__imbaba', NULL);
INSERT INTO public.locations VALUES ('giza__boulaq_dakrour', 'area', 'بولاق الدكرور', 'Boulaq Dakrour', 'giza', 'giza__boulaq_dakrour', NULL);
INSERT INTO public.locations VALUES ('giza__al_wahat_al_baharia', 'area', 'الواحات البحرية', 'Al Wahat Al Baharia', 'giza', 'giza__al_wahat_al_baharia', NULL);
INSERT INTO public.locations VALUES ('giza__omraneya', 'area', 'العمرانية', 'Omraneya', 'giza', 'giza__omraneya', NULL);
INSERT INTO public.locations VALUES ('giza__moneeb', 'area', 'المنيب', 'Moneeb', 'giza', 'giza__moneeb', NULL);
INSERT INTO public.locations VALUES ('giza__bin_alsarayat', 'area', 'بين السرايات', 'Bin Alsarayat', 'giza', 'giza__bin_alsarayat', NULL);
INSERT INTO public.locations VALUES ('giza__kit_kat', 'area', 'الكيت كات', 'Kit Kat', 'giza', 'giza__kit_kat', NULL);
INSERT INTO public.locations VALUES ('giza__mohandessin', 'area', 'المهندسين', 'Mohandessin', 'giza', 'giza__mohandessin', NULL);
INSERT INTO public.locations VALUES ('giza__faisal', 'area', 'فيصل', 'Faisal', 'giza', 'giza__faisal', NULL);
INSERT INTO public.locations VALUES ('giza__abu_rawash', 'area', 'أبو رواش', 'Abu Rawash', 'giza', 'giza__abu_rawash', NULL);
INSERT INTO public.locations VALUES ('giza__hadayek_alahram', 'area', 'حدائق الأهرام', 'Hadayek Alahram', 'giza', 'giza__hadayek_alahram', NULL);
INSERT INTO public.locations VALUES ('giza__haraneya', 'area', 'الحرانية', 'Haraneya', 'giza', 'giza__haraneya', NULL);
INSERT INTO public.locations VALUES ('giza__hadayek_october', 'area', 'حدائق اكتوبر', 'Hadayek October', 'giza', 'giza__hadayek_october', NULL);
INSERT INTO public.locations VALUES ('giza__saft_allaban', 'area', 'صفط اللبن', 'Saft Allaban', 'giza', 'giza__saft_allaban', NULL);
INSERT INTO public.locations VALUES ('giza__smart_village', 'area', 'القرية الذكية', 'Smart Village', 'giza', 'giza__smart_village', NULL);
INSERT INTO public.locations VALUES ('giza__ard_ellwaa', 'area', 'ارض اللواء', 'Ard Ellwaa', 'giza', 'giza__ard_ellwaa', NULL);
INSERT INTO public.locations VALUES ('alexandria', 'governorate', 'الإسكندرية', 'Alexandria', NULL, 'alexandria', NULL);
INSERT INTO public.locations VALUES ('alexandria__abu_qir', 'area', 'ابو قير', 'Abu Qir', 'alexandria', 'alexandria__abu_qir', NULL);
INSERT INTO public.locations VALUES ('alexandria__al_ibrahimeyah', 'area', 'الابراهيمية', 'Al Ibrahimeyah', 'alexandria', 'alexandria__al_ibrahimeyah', NULL);
INSERT INTO public.locations VALUES ('alexandria__azarita', 'area', 'الأزاريطة', 'Azarita', 'alexandria', 'alexandria__azarita', NULL);
INSERT INTO public.locations VALUES ('alexandria__anfoushi', 'area', 'الانفوشى', 'Anfoushi', 'alexandria', 'alexandria__anfoushi', NULL);
INSERT INTO public.locations VALUES ('alexandria__dekheila', 'area', 'الدخيلة', 'Dekheila', 'alexandria', 'alexandria__dekheila', NULL);
INSERT INTO public.locations VALUES ('alexandria__el_soyof', 'area', 'السيوف', 'El Soyof', 'alexandria', 'alexandria__el_soyof', NULL);
INSERT INTO public.locations VALUES ('alexandria__ameria', 'area', 'العامرية', 'Ameria', 'alexandria', 'alexandria__ameria', NULL);
INSERT INTO public.locations VALUES ('alexandria__el_labban', 'area', 'اللبان', 'El Labban', 'alexandria', 'alexandria__el_labban', NULL);
INSERT INTO public.locations VALUES ('alexandria__al_mafrouza', 'area', 'المفروزة', 'Al Mafrouza', 'alexandria', 'alexandria__al_mafrouza', NULL);
INSERT INTO public.locations VALUES ('alexandria__el_montaza', 'area', 'المنتزه', 'El Montaza', 'alexandria', 'alexandria__el_montaza', NULL);
INSERT INTO public.locations VALUES ('alexandria__naseria', 'area', 'الناصرية', 'Naseria', 'alexandria', 'alexandria__naseria', NULL);
INSERT INTO public.locations VALUES ('alexandria__bourj_alarab', 'area', 'برج العرب', 'Bourj Alarab', 'alexandria', 'alexandria__bourj_alarab', NULL);
INSERT INTO public.locations VALUES ('alexandria__stanley', 'area', 'ستانلى', 'Stanley', 'alexandria', 'alexandria__stanley', NULL);
INSERT INTO public.locations VALUES ('alexandria__smouha', 'area', 'سموحة', 'Smouha', 'alexandria', 'alexandria__smouha', NULL);
INSERT INTO public.locations VALUES ('alexandria__sidi_bishr', 'area', 'سيدى بشر', 'Sidi Bishr', 'alexandria', 'alexandria__sidi_bishr', NULL);
INSERT INTO public.locations VALUES ('alexandria__shads', 'area', 'شدس', 'Shads', 'alexandria', 'alexandria__shads', NULL);
INSERT INTO public.locations VALUES ('alexandria__gheet_alenab', 'area', 'غيط العنب', 'Gheet Alenab', 'alexandria', 'alexandria__gheet_alenab', NULL);
INSERT INTO public.locations VALUES ('alexandria__victoria', 'area', 'فيكتوريا', 'Victoria', 'alexandria', 'alexandria__victoria', NULL);
INSERT INTO public.locations VALUES ('alexandria__camp_shizar', 'area', 'كامب شيزار', 'Camp Shizar', 'alexandria', 'alexandria__camp_shizar', NULL);
INSERT INTO public.locations VALUES ('alexandria__mahta_alraml', 'area', 'محطة الرمل', 'Mahta Alraml', 'alexandria', 'alexandria__mahta_alraml', NULL);
INSERT INTO public.locations VALUES ('alexandria__mina_elbasal', 'area', 'مينا البصل', 'Mina El-Basal', 'alexandria', 'alexandria__mina_elbasal', NULL);
INSERT INTO public.locations VALUES ('alexandria__asafra', 'area', 'العصافرة', 'Asafra', 'alexandria', 'alexandria__asafra', NULL);
INSERT INTO public.locations VALUES ('alexandria__agamy', 'area', 'العجمي', 'Agamy', 'alexandria', 'alexandria__agamy', NULL);
INSERT INTO public.locations VALUES ('alexandria__bakos', 'area', 'بكوس', 'Bakos', 'alexandria', 'alexandria__bakos', NULL);
INSERT INTO public.locations VALUES ('alexandria__boulkly', 'area', 'بولكلي', 'Boulkly', 'alexandria', 'alexandria__boulkly', NULL);
INSERT INTO public.locations VALUES ('alexandria__cleopatra', 'area', 'كليوباترا', 'Cleopatra', 'alexandria', 'alexandria__cleopatra', NULL);
INSERT INTO public.locations VALUES ('alexandria__glim', 'area', 'جليم', 'Glim', 'alexandria', 'alexandria__glim', NULL);
INSERT INTO public.locations VALUES ('alexandria__al_mamurah', 'area', 'المعمورة', 'Al Mamurah', 'alexandria', 'alexandria__al_mamurah', NULL);
INSERT INTO public.locations VALUES ('alexandria__al_mandara', 'area', 'المندرة', 'Al Mandara', 'alexandria', 'alexandria__al_mandara', NULL);
INSERT INTO public.locations VALUES ('alexandria__moharam_bek', 'area', 'محرم بك', 'Moharam Bek', 'alexandria', 'alexandria__moharam_bek', NULL);
INSERT INTO public.locations VALUES ('alexandria__elshatby', 'area', 'الشاطبي', 'Elshatby', 'alexandria', 'alexandria__elshatby', NULL);
INSERT INTO public.locations VALUES ('alexandria__sidi_gaber', 'area', 'سيدي جابر', 'Sidi Gaber', 'alexandria', 'alexandria__sidi_gaber', NULL);
INSERT INTO public.locations VALUES ('alexandria__north_coastsahel', 'area', 'الساحل الشمالي', 'North Coast/sahel', 'alexandria', 'alexandria__north_coastsahel', NULL);
INSERT INTO public.locations VALUES ('alexandria__alhadra', 'area', 'الحضرة', 'Alhadra', 'alexandria', 'alexandria__alhadra', NULL);
INSERT INTO public.locations VALUES ('alexandria__alattarin', 'area', 'العطارين', 'Alattarin', 'alexandria', 'alexandria__alattarin', NULL);
INSERT INTO public.locations VALUES ('alexandria__sidi_kerir', 'area', 'سيدي كرير', 'Sidi Kerir', 'alexandria', 'alexandria__sidi_kerir', NULL);
INSERT INTO public.locations VALUES ('alexandria__elgomrok', 'area', 'الجمرك', 'Elgomrok', 'alexandria', 'alexandria__elgomrok', NULL);
INSERT INTO public.locations VALUES ('alexandria__al_max', 'area', 'المكس', 'Al Max', 'alexandria', 'alexandria__al_max', NULL);
INSERT INTO public.locations VALUES ('alexandria__marina', 'area', 'مارينا', 'Marina', 'alexandria', 'alexandria__marina', NULL);
INSERT INTO public.locations VALUES ('dakahlia', 'governorate', 'الدقهلية', 'Dakahlia', NULL, 'dakahlia', NULL);
INSERT INTO public.locations VALUES ('dakahlia__talkha', 'area', 'طلخا', 'Talkha', 'dakahlia', 'dakahlia__talkha', NULL);
INSERT INTO public.locations VALUES ('dakahlia__mitt_ghamr', 'area', 'ميت غمر', 'Mitt Ghamr', 'dakahlia', 'dakahlia__mitt_ghamr', NULL);
INSERT INTO public.locations VALUES ('dakahlia__dekernes', 'area', 'دكرنس', 'Dekernes', 'dakahlia', 'dakahlia__dekernes', NULL);
INSERT INTO public.locations VALUES ('dakahlia__aga', 'area', 'أجا', 'Aga', 'dakahlia', 'dakahlia__aga', NULL);
INSERT INTO public.locations VALUES ('dakahlia__menia_el_nasr', 'area', 'منية النصر', 'Menia El Nasr', 'dakahlia', 'dakahlia__menia_el_nasr', NULL);
INSERT INTO public.locations VALUES ('dakahlia__sinbillawin', 'area', 'السنبلاوين', 'Sinbillawin', 'dakahlia', 'dakahlia__sinbillawin', NULL);
INSERT INTO public.locations VALUES ('dakahlia__el_kurdi', 'area', 'الكردي', 'El Kurdi', 'dakahlia', 'dakahlia__el_kurdi', NULL);
INSERT INTO public.locations VALUES ('dakahlia__bani_ubaid', 'area', 'بني عبيد', 'Bani Ubaid', 'dakahlia', 'dakahlia__bani_ubaid', NULL);
INSERT INTO public.locations VALUES ('dakahlia__al_manzala', 'area', 'المنزلة', 'Al Manzala', 'dakahlia', 'dakahlia__al_manzala', NULL);
INSERT INTO public.locations VALUES ('dakahlia__tami_alamdid', 'area', 'تمي الأمديد', 'tami al''amdid', 'dakahlia', 'dakahlia__tami_alamdid', NULL);
INSERT INTO public.locations VALUES ('dakahlia__aljamalia', 'area', 'الجمالية', 'aljamalia', 'dakahlia', 'dakahlia__aljamalia', NULL);
INSERT INTO public.locations VALUES ('dakahlia__sherbin', 'area', 'شربين', 'Sherbin', 'dakahlia', 'dakahlia__sherbin', NULL);
INSERT INTO public.locations VALUES ('dakahlia__mataria', 'area', 'المطرية', 'Mataria', 'dakahlia', 'dakahlia__mataria', NULL);
INSERT INTO public.locations VALUES ('dakahlia__belqas', 'area', 'بلقاس', 'Belqas', 'dakahlia', 'dakahlia__belqas', NULL);
INSERT INTO public.locations VALUES ('dakahlia__meet_salsil', 'area', 'ميت سلسيل', 'Meet Salsil', 'dakahlia', 'dakahlia__meet_salsil', NULL);
INSERT INTO public.locations VALUES ('dakahlia__gamasa', 'area', 'جمصة', 'Gamasa', 'dakahlia', 'dakahlia__gamasa', NULL);
INSERT INTO public.locations VALUES ('dakahlia__mahalat_damana', 'area', 'محلة دمنة', 'Mahalat Damana', 'dakahlia', 'dakahlia__mahalat_damana', NULL);
INSERT INTO public.locations VALUES ('dakahlia__nabroh', 'area', 'نبروه', 'Nabroh', 'dakahlia', 'dakahlia__nabroh', NULL);
INSERT INTO public.locations VALUES ('red_sea', 'governorate', 'البحر الأحمر', 'Red Sea', NULL, 'red_sea', NULL);
INSERT INTO public.locations VALUES ('red_sea__hurghada', 'area', 'الغردقة', 'Hurghada', 'red_sea', 'red_sea__hurghada', NULL);
INSERT INTO public.locations VALUES ('red_sea__ras_ghareb', 'area', 'رأس غارب', 'Ras Ghareb', 'red_sea', 'red_sea__ras_ghareb', NULL);
INSERT INTO public.locations VALUES ('red_sea__safaga', 'area', 'سفاجا', 'Safaga', 'red_sea', 'red_sea__safaga', NULL);
INSERT INTO public.locations VALUES ('red_sea__el_qusiar', 'area', 'القصير', 'El Qusiar', 'red_sea', 'red_sea__el_qusiar', NULL);
INSERT INTO public.locations VALUES ('red_sea__marsa_alam', 'area', 'مرسى علم', 'Marsa Alam', 'red_sea', 'red_sea__marsa_alam', NULL);
INSERT INTO public.locations VALUES ('red_sea__shalatin', 'area', 'الشلاتين', 'Shalatin', 'red_sea', 'red_sea__shalatin', NULL);
INSERT INTO public.locations VALUES ('red_sea__halaib', 'area', 'حلايب', 'Halaib', 'red_sea', 'red_sea__halaib', NULL);
INSERT INTO public.locations VALUES ('red_sea__aldahar', 'area', 'الدهار', 'Aldahar', 'red_sea', 'red_sea__aldahar', NULL);
INSERT INTO public.locations VALUES ('beheira', 'governorate', 'البحيرة', 'Beheira', NULL, 'beheira', NULL);
INSERT INTO public.locations VALUES ('beheira__damanhour', 'area', 'دمنهور', 'Damanhour', 'beheira', 'beheira__damanhour', NULL);
INSERT INTO public.locations VALUES ('beheira__kafr_el_dawar', 'area', 'كفر الدوار', 'Kafr El Dawar', 'beheira', 'beheira__kafr_el_dawar', NULL);
INSERT INTO public.locations VALUES ('beheira__rashid', 'area', 'رشيد', 'Rashid', 'beheira', 'beheira__rashid', NULL);
INSERT INTO public.locations VALUES ('beheira__edco', 'area', 'إدكو', 'Edco', 'beheira', 'beheira__edco', NULL);
INSERT INTO public.locations VALUES ('beheira__abu_almatamir', 'area', 'أبو المطامير', 'Abu al-Matamir', 'beheira', 'beheira__abu_almatamir', NULL);
INSERT INTO public.locations VALUES ('beheira__abu_homs', 'area', 'أبو حمص', 'Abu Homs', 'beheira', 'beheira__abu_homs', NULL);
INSERT INTO public.locations VALUES ('beheira__delengat', 'area', 'الدلنجات', 'Delengat', 'beheira', 'beheira__delengat', NULL);
INSERT INTO public.locations VALUES ('beheira__itai_baroud', 'area', 'إيتاي البارود', 'Itai Baroud', 'beheira', 'beheira__itai_baroud', NULL);
INSERT INTO public.locations VALUES ('beheira__housh_eissa', 'area', 'حوش عيسى', 'Housh Eissa', 'beheira', 'beheira__housh_eissa', NULL);
INSERT INTO public.locations VALUES ('beheira__badr', 'area', 'بدر', 'Badr', 'beheira', 'beheira__badr', NULL);
INSERT INTO public.locations VALUES ('fayoum__fayoum_el_gedida', 'area', 'الفيوم الجديدة', 'Fayoum El Gedida', 'fayoum', 'fayoum__fayoum_el_gedida', NULL);
INSERT INTO public.locations VALUES ('fayoum__sayala', 'area', 'السيالة', 'Sayala', 'fayoum', 'fayoum__sayala', NULL);
INSERT INTO public.locations VALUES ('gharbiya', 'governorate', 'الغربية', 'Gharbiya', NULL, 'gharbiya', NULL);
INSERT INTO public.locations VALUES ('gharbiya__tanta', 'area', 'طنطا', 'Tanta', 'gharbiya', 'gharbiya__tanta', NULL);
INSERT INTO public.locations VALUES ('gharbiya__al_mahalla_al_kobra', 'area', 'المحلة الكبرى', 'Al Mahalla Al Kobra', 'gharbiya', 'gharbiya__al_mahalla_al_kobra', NULL);
INSERT INTO public.locations VALUES ('gharbiya__kafr_el_zayat', 'area', 'كفر الزيات', 'Kafr El Zayat', 'gharbiya', 'gharbiya__kafr_el_zayat', NULL);
INSERT INTO public.locations VALUES ('gharbiya__zefta', 'area', 'زفتى', 'Zefta', 'gharbiya', 'gharbiya__zefta', NULL);
INSERT INTO public.locations VALUES ('gharbiya__el_santa', 'area', 'السنطة', 'El Santa', 'gharbiya', 'gharbiya__el_santa', NULL);
INSERT INTO public.locations VALUES ('gharbiya__qutour', 'area', 'قطور', 'Qutour', 'gharbiya', 'gharbiya__qutour', NULL);
INSERT INTO public.locations VALUES ('gharbiya__basion', 'area', 'بسيون', 'Basion', 'gharbiya', 'gharbiya__basion', NULL);
INSERT INTO public.locations VALUES ('gharbiya__samannoud', 'area', 'سمنود', 'Samannoud', 'gharbiya', 'gharbiya__samannoud', NULL);
INSERT INTO public.locations VALUES ('ismailia', 'governorate', 'الإسماعلية', 'Ismailia', NULL, 'ismailia', NULL);
INSERT INTO public.locations VALUES ('ismailia__ismailia', 'area', 'الإسماعيلية', 'Ismailia', 'ismailia', 'ismailia__ismailia', NULL);
INSERT INTO public.locations VALUES ('ismailia__fayed', 'area', 'فايد', 'Fayed', 'ismailia', 'ismailia__fayed', NULL);
INSERT INTO public.locations VALUES ('ismailia__qantara_sharq', 'area', 'القنطرة شرق', 'Qantara Sharq', 'ismailia', 'ismailia__qantara_sharq', NULL);
INSERT INTO public.locations VALUES ('ismailia__qantara_gharb', 'area', 'القنطرة غرب', 'Qantara Gharb', 'ismailia', 'ismailia__qantara_gharb', NULL);
INSERT INTO public.locations VALUES ('ismailia__el_tal_el_kabier', 'area', 'التل الكبير', 'El Tal El Kabier', 'ismailia', 'ismailia__el_tal_el_kabier', NULL);
INSERT INTO public.locations VALUES ('ismailia__abu_sawir', 'area', 'أبو صوير', 'Abu Sawir', 'ismailia', 'ismailia__abu_sawir', NULL);
INSERT INTO public.locations VALUES ('ismailia__kasasien_el_gedida', 'area', 'القصاصين الجديدة', 'Kasasien El Gedida', 'ismailia', 'ismailia__kasasien_el_gedida', NULL);
INSERT INTO public.locations VALUES ('ismailia__nefesha', 'area', 'نفيشة', 'Nefesha', 'ismailia', 'ismailia__nefesha', NULL);
INSERT INTO public.locations VALUES ('ismailia__sheikh_zayed', 'area', 'الشيخ زايد', 'Sheikh Zayed', 'ismailia', 'ismailia__sheikh_zayed', NULL);
INSERT INTO public.locations VALUES ('menofia__shbeen_el_koom', 'area', 'شبين الكوم', 'Shbeen El Koom', 'menofia', 'menofia__shbeen_el_koom', NULL);
INSERT INTO public.locations VALUES ('menofia__sadat_city', 'area', 'مدينة السادات', 'Sadat City', 'menofia', 'menofia__sadat_city', NULL);
INSERT INTO public.locations VALUES ('menofia__menouf', 'area', 'منوف', 'Menouf', 'menofia', 'menofia__menouf', NULL);
INSERT INTO public.locations VALUES ('menofia__sars_ellayan', 'area', 'سرس الليان', 'Sars El-Layan', 'menofia', 'menofia__sars_ellayan', NULL);
INSERT INTO public.locations VALUES ('menofia__ashmon', 'area', 'أشمون', 'Ashmon', 'menofia', 'menofia__ashmon', NULL);
INSERT INTO public.locations VALUES ('menofia__al_bagor', 'area', 'الباجور', 'Al Bagor', 'menofia', 'menofia__al_bagor', NULL);
INSERT INTO public.locations VALUES ('menofia__quesna', 'area', 'قويسنا', 'Quesna', 'menofia', 'menofia__quesna', NULL);
INSERT INTO public.locations VALUES ('menofia__berkat_el_saba', 'area', 'بركة السبع', 'Berkat El Saba', 'menofia', 'menofia__berkat_el_saba', NULL);
INSERT INTO public.locations VALUES ('menofia__tala', 'area', 'تلا', 'Tala', 'menofia', 'menofia__tala', NULL);
INSERT INTO public.locations VALUES ('menofia__al_shohada', 'area', 'الشهداء', 'Al Shohada', 'menofia', 'menofia__al_shohada', NULL);
INSERT INTO public.locations VALUES ('minya', 'governorate', 'المنيا', 'Minya', NULL, 'minya', NULL);
INSERT INTO public.locations VALUES ('minya__el_adwa', 'area', 'العدوة', 'El Adwa', 'minya', 'minya__el_adwa', NULL);
INSERT INTO public.locations VALUES ('minya__magagha', 'area', 'مغاغة', 'Magagha', 'minya', 'minya__magagha', NULL);
INSERT INTO public.locations VALUES ('minya__bani_mazar', 'area', 'بني مزار', 'Bani Mazar', 'minya', 'minya__bani_mazar', NULL);
INSERT INTO public.locations VALUES ('minya__samalut', 'area', 'سمالوط', 'Samalut', 'minya', 'minya__samalut', NULL);
INSERT INTO public.locations VALUES ('minya__madinat_el_fekria', 'area', 'المدينة الفكرية', 'Madinat El Fekria', 'minya', 'minya__madinat_el_fekria', NULL);
INSERT INTO public.locations VALUES ('minya__meloy', 'area', 'ملوي', 'Meloy', 'minya', 'minya__meloy', NULL);
INSERT INTO public.locations VALUES ('minya__deir_mawas', 'area', 'دير مواس', 'Deir Mawas', 'minya', 'minya__deir_mawas', NULL);
INSERT INTO public.locations VALUES ('minya__abu_qurqas', 'area', 'ابو قرقاص', 'Abu Qurqas', 'minya', 'minya__abu_qurqas', NULL);
INSERT INTO public.locations VALUES ('minya__ard_sultan', 'area', 'ارض سلطان', 'Ard Sultan', 'minya', 'minya__ard_sultan', NULL);
INSERT INTO public.locations VALUES ('qaliubiya', 'governorate', 'القليوبية', 'Qaliubiya', NULL, 'qaliubiya', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__banha', 'area', 'بنها', 'Banha', 'qaliubiya', 'qaliubiya__banha', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__qalyub', 'area', 'قليوب', 'Qalyub', 'qaliubiya', 'qaliubiya__qalyub', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__shubra_al_khaimah', 'area', 'شبرا الخيمة', 'Shubra Al Khaimah', 'qaliubiya', 'qaliubiya__shubra_al_khaimah', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__al_qanater_charity', 'area', 'القناطر الخيرية', 'Al Qanater Charity', 'qaliubiya', 'qaliubiya__al_qanater_charity', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__khanka', 'area', 'الخانكة', 'Khanka', 'qaliubiya', 'qaliubiya__khanka', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__kafr_shukr', 'area', 'كفر شكر', 'Kafr Shukr', 'qaliubiya', 'qaliubiya__kafr_shukr', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__tukh', 'area', 'طوخ', 'Tukh', 'qaliubiya', 'qaliubiya__tukh', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__qaha', 'area', 'قها', 'Qaha', 'qaliubiya', 'qaliubiya__qaha', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__obour', 'area', 'العبور', 'Obour', 'qaliubiya', 'qaliubiya__obour', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__khosous', 'area', 'الخصوص', 'Khosous', 'qaliubiya', 'qaliubiya__khosous', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__shibin_al_qanater', 'area', 'شبين القناطر', 'Shibin Al Qanater', 'qaliubiya', 'qaliubiya__shibin_al_qanater', NULL);
INSERT INTO public.locations VALUES ('qaliubiya__mostorod', 'area', 'مسطرد', 'Mostorod', 'qaliubiya', 'qaliubiya__mostorod', NULL);
INSERT INTO public.locations VALUES ('new_valley', 'governorate', 'الوادي الجديد', 'New Valley', NULL, 'new_valley', NULL);
INSERT INTO public.locations VALUES ('new_valley__el_kharga', 'area', 'الخارجة', 'El Kharga', 'new_valley', 'new_valley__el_kharga', NULL);
INSERT INTO public.locations VALUES ('new_valley__paris', 'area', 'باريس', 'Paris', 'new_valley', 'new_valley__paris', NULL);
INSERT INTO public.locations VALUES ('new_valley__mout', 'area', 'موط', 'Mout', 'new_valley', 'new_valley__mout', NULL);
INSERT INTO public.locations VALUES ('new_valley__farafra', 'area', 'الفرافرة', 'Farafra', 'new_valley', 'new_valley__farafra', NULL);
INSERT INTO public.locations VALUES ('new_valley__balat', 'area', 'بلاط', 'Balat', 'new_valley', 'new_valley__balat', NULL);
INSERT INTO public.locations VALUES ('new_valley__dakhla', 'area', 'الداخلة', 'Dakhla', 'new_valley', 'new_valley__dakhla', NULL);
INSERT INTO public.locations VALUES ('suez__suez', 'area', 'السويس', 'Suez', 'suez', 'suez__suez', NULL);
INSERT INTO public.locations VALUES ('suez__alganayen', 'area', 'الجناين', 'Alganayen', 'suez', 'suez__alganayen', NULL);
INSERT INTO public.locations VALUES ('suez__ataqah', 'area', 'عتاقة', 'Ataqah', 'suez', 'suez__ataqah', NULL);
INSERT INTO public.locations VALUES ('suez__ain_sokhna', 'area', 'العين السخنة', 'Ain Sokhna', 'suez', 'suez__ain_sokhna', NULL);
INSERT INTO public.locations VALUES ('suez__faysal', 'area', 'فيصل', 'Faysal', 'suez', 'suez__faysal', NULL);
INSERT INTO public.locations VALUES ('aswan', 'governorate', 'اسوان', 'Aswan', NULL, 'aswan', NULL);
INSERT INTO public.locations VALUES ('aswan__aswan', 'area', 'أسوان', 'Aswan', 'aswan', 'aswan__aswan', NULL);
INSERT INTO public.locations VALUES ('aswan__aswan_el_gedida', 'area', 'أسوان الجديدة', 'Aswan El Gedida', 'aswan', 'aswan__aswan_el_gedida', NULL);
INSERT INTO public.locations VALUES ('aswan__drau', 'area', 'دراو', 'Drau', 'aswan', 'aswan__drau', NULL);
INSERT INTO public.locations VALUES ('aswan__kom_ombo', 'area', 'كوم أمبو', 'Kom Ombo', 'aswan', 'aswan__kom_ombo', NULL);
INSERT INTO public.locations VALUES ('aswan__nasr_al_nuba', 'area', 'نصر النوبة', 'Nasr Al Nuba', 'aswan', 'aswan__nasr_al_nuba', NULL);
INSERT INTO public.locations VALUES ('sharkia__zagazig', 'area', 'الزقازيق', 'Zagazig', 'sharkia', 'sharkia__zagazig', NULL);
INSERT INTO public.locations VALUES ('sharkia__al_ashr_men_ramadan', 'area', 'العاشر من رمضان', 'Al Ashr Men Ramadan', 'sharkia', 'sharkia__al_ashr_men_ramadan', NULL);
INSERT INTO public.locations VALUES ('sharkia__minya_al_qamh', 'area', 'منيا القمح', 'Minya Al Qamh', 'sharkia', 'sharkia__minya_al_qamh', NULL);
INSERT INTO public.locations VALUES ('sharkia__belbeis', 'area', 'بلبيس', 'Belbeis', 'sharkia', 'sharkia__belbeis', NULL);
INSERT INTO public.locations VALUES ('sharkia__mashtoul_el_souq', 'area', 'مشتول السوق', 'Mashtoul El Souq', 'sharkia', 'sharkia__mashtoul_el_souq', NULL);
INSERT INTO public.locations VALUES ('sharkia__qenaiat', 'area', 'القنايات', 'Qenaiat', 'sharkia', 'sharkia__qenaiat', NULL);
INSERT INTO public.locations VALUES ('sharkia__abu_hammad', 'area', 'أبو حماد', 'Abu Hammad', 'sharkia', 'sharkia__abu_hammad', NULL);
INSERT INTO public.locations VALUES ('sharkia__el_qurain', 'area', 'القرين', 'El Qurain', 'sharkia', 'sharkia__el_qurain', NULL);
INSERT INTO public.locations VALUES ('sharkia__abu_kabir', 'area', 'أبو كبير', 'Abu Kabir', 'sharkia', 'sharkia__abu_kabir', NULL);
INSERT INTO public.locations VALUES ('sharkia__faccus', 'area', 'فاقوس', 'Faccus', 'sharkia', 'sharkia__faccus', NULL);
INSERT INTO public.locations VALUES ('sharkia__el_salihia_el_gedida', 'area', 'الصالحية الجديدة', 'El Salihia El Gedida', 'sharkia', 'sharkia__el_salihia_el_gedida', NULL);
INSERT INTO public.locations VALUES ('aswan__al_basilia', 'area', 'البصيلية', 'Al Basilia', 'aswan', 'aswan__al_basilia', NULL);
INSERT INTO public.locations VALUES ('aswan__al_sibaeia', 'area', 'السباعية', 'Al Sibaeia', 'aswan', 'aswan__al_sibaeia', NULL);
INSERT INTO public.locations VALUES ('aswan__abo_simbl_al_siyahia', 'area', 'ابوسمبل السياحية', 'Abo Simbl Al Siyahia', 'aswan', 'aswan__abo_simbl_al_siyahia', NULL);
INSERT INTO public.locations VALUES ('aswan__marsa_alam', 'area', 'مرسى علم', 'Marsa Alam', 'aswan', 'aswan__marsa_alam', NULL);
INSERT INTO public.locations VALUES ('assiut', 'governorate', 'اسيوط', 'Assiut', NULL, 'assiut', NULL);
INSERT INTO public.locations VALUES ('assiut__assiut', 'area', 'أسيوط', 'Assiut', 'assiut', 'assiut__assiut', NULL);
INSERT INTO public.locations VALUES ('assiut__assiut_el_gedida', 'area', 'أسيوط الجديدة', 'Assiut El Gedida', 'assiut', 'assiut__assiut_el_gedida', NULL);
INSERT INTO public.locations VALUES ('assiut__dayrout', 'area', 'ديروط', 'Dayrout', 'assiut', 'assiut__dayrout', NULL);
INSERT INTO public.locations VALUES ('assiut__manfalut', 'area', 'منفلوط', 'Manfalut', 'assiut', 'assiut__manfalut', NULL);
INSERT INTO public.locations VALUES ('assiut__qusiya', 'area', 'القوصية', 'Qusiya', 'assiut', 'assiut__qusiya', NULL);
INSERT INTO public.locations VALUES ('assiut__abnoub', 'area', 'أبنوب', 'Abnoub', 'assiut', 'assiut__abnoub', NULL);
INSERT INTO public.locations VALUES ('assiut__abu_tig', 'area', 'أبو تيج', 'Abu Tig', 'assiut', 'assiut__abu_tig', NULL);
INSERT INTO public.locations VALUES ('assiut__el_ghanaim', 'area', 'الغنايم', 'El Ghanaim', 'assiut', 'assiut__el_ghanaim', NULL);
INSERT INTO public.locations VALUES ('beni_suef', 'governorate', 'بني سويف', 'Beni Suef', NULL, 'beni_suef', NULL);
INSERT INTO public.locations VALUES ('damietta__kafr_saad', 'area', 'كفر سعد', 'Kafr Saad', 'damietta', 'damietta__kafr_saad', NULL);
INSERT INTO public.locations VALUES ('sharkia__awlad_saqr', 'area', 'أولاد صقر', 'Awlad Saqr', 'sharkia', 'sharkia__awlad_saqr', NULL);
INSERT INTO public.locations VALUES ('sharkia__husseiniya', 'area', 'الحسينية', 'Husseiniya', 'sharkia', 'sharkia__husseiniya', NULL);
INSERT INTO public.locations VALUES ('sharkia__san_alhajar_alqablia', 'area', 'صان الحجر القبلية', 'san alhajar alqablia', 'sharkia', 'sharkia__san_alhajar_alqablia', NULL);
INSERT INTO public.locations VALUES ('sharkia__manshayat_abu_omar', 'area', 'منشأة أبو عمر', 'Manshayat Abu Omar', 'sharkia', 'sharkia__manshayat_abu_omar', NULL);
INSERT INTO public.locations VALUES ('south_sinai', 'governorate', 'جنوب سيناء', 'South Sinai', NULL, 'south_sinai', NULL);
INSERT INTO public.locations VALUES ('kafr_al_sheikh__bella', 'area', 'بيلا', 'Bella', 'kafr_al_sheikh', 'kafr_al_sheikh__bella', NULL);
INSERT INTO public.locations VALUES ('matrouh', 'governorate', 'مطروح', 'Matrouh', NULL, 'matrouh', NULL);
INSERT INTO public.locations VALUES ('matrouh__marsa_matrouh', 'area', 'مرسى مطروح', 'Marsa Matrouh', 'matrouh', 'matrouh__marsa_matrouh', NULL);
INSERT INTO public.locations VALUES ('matrouh__el_hamam', 'area', 'الحمام', 'El Hamam', 'matrouh', 'matrouh__el_hamam', NULL);
INSERT INTO public.locations VALUES ('matrouh__alamein', 'area', 'العلمين', 'Alamein', 'matrouh', 'matrouh__alamein', NULL);
INSERT INTO public.locations VALUES ('matrouh__siwa', 'area', 'سيوة', 'Siwa', 'matrouh', 'matrouh__siwa', NULL);
INSERT INTO public.locations VALUES ('matrouh__marina', 'area', 'مارينا', 'Marina', 'matrouh', 'matrouh__marina', NULL);
INSERT INTO public.locations VALUES ('matrouh__north_coast', 'area', 'الساحل الشمالى', 'North Coast', 'matrouh', 'matrouh__north_coast', NULL);
INSERT INTO public.locations VALUES ('luxor__al_qarna', 'area', 'القرنة', 'Al Qarna', 'luxor', 'luxor__al_qarna', NULL);
INSERT INTO public.locations VALUES ('luxor__armant', 'area', 'أرمنت', 'Armant', 'luxor', 'luxor__armant', NULL);
INSERT INTO public.locations VALUES ('qena__nag_hammadi', 'area', 'نجع حمادي', 'Nag Hammadi', 'qena', 'qena__nag_hammadi', NULL);
INSERT INTO public.locations VALUES ('qena__deshna', 'area', 'دشنا', 'Deshna', 'qena', 'qena__deshna', NULL);
INSERT INTO public.locations VALUES ('qena__alwaqf', 'area', 'الوقف', 'Alwaqf', 'qena', 'qena__alwaqf', NULL);
INSERT INTO public.locations VALUES ('qena__qaft', 'area', 'قفط', 'Qaft', 'qena', 'qena__qaft', NULL);
INSERT INTO public.locations VALUES ('qena__naqada', 'area', 'نقادة', 'Naqada', 'qena', 'qena__naqada', NULL);
INSERT INTO public.locations VALUES ('qena__farshout', 'area', 'فرشوط', 'Farshout', 'qena', 'qena__farshout', NULL);
INSERT INTO public.locations VALUES ('qena__quos', 'area', 'قوص', 'Quos', 'qena', 'qena__quos', NULL);
INSERT INTO public.locations VALUES ('north_sinai', 'governorate', 'شمال سيناء', 'North Sinai', NULL, 'north_sinai', NULL);
INSERT INTO public.locations VALUES ('north_sinai__arish', 'area', 'العريش', 'Arish', 'north_sinai', 'north_sinai__arish', NULL);
INSERT INTO public.locations VALUES ('north_sinai__sheikh_zowaid', 'area', 'الشيخ زويد', 'Sheikh Zowaid', 'north_sinai', 'north_sinai__sheikh_zowaid', NULL);
INSERT INTO public.locations VALUES ('north_sinai__nakhl', 'area', 'نخل', 'Nakhl', 'north_sinai', 'north_sinai__nakhl', NULL);
INSERT INTO public.locations VALUES ('north_sinai__rafah', 'area', 'رفح', 'Rafah', 'north_sinai', 'north_sinai__rafah', NULL);
INSERT INTO public.locations VALUES ('north_sinai__bir_alabed', 'area', 'بئر العبد', 'Bir al-Abed', 'north_sinai', 'north_sinai__bir_alabed', NULL);
INSERT INTO public.locations VALUES ('north_sinai__al_hasana', 'area', 'الحسنة', 'Al Hasana', 'north_sinai', 'north_sinai__al_hasana', NULL);
INSERT INTO public.locations VALUES ('sohag__sohag', 'area', 'سوهاج', 'Sohag', 'sohag', 'sohag__sohag', NULL);
INSERT INTO public.locations VALUES ('sohag__sohag_el_gedida', 'area', 'سوهاج الجديدة', 'Sohag El Gedida', 'sohag', 'sohag__sohag_el_gedida', NULL);
INSERT INTO public.locations VALUES ('sohag__akhmeem', 'area', 'أخميم', 'Akhmeem', 'sohag', 'sohag__akhmeem', NULL);
INSERT INTO public.locations VALUES ('sohag__akhmim_el_gedida', 'area', 'أخميم الجديدة', 'Akhmim El Gedida', 'sohag', 'sohag__akhmim_el_gedida', NULL);
INSERT INTO public.locations VALUES ('sohag__albalina', 'area', 'البلينا', 'Albalina', 'sohag', 'sohag__albalina', NULL);
INSERT INTO public.locations VALUES ('sohag__el_maragha', 'area', 'المراغة', 'El Maragha', 'sohag', 'sohag__el_maragha', NULL);
INSERT INTO public.locations VALUES ('sohag__almunshaa', 'area', 'المنشأة', 'almunsha''a', 'sohag', 'sohag__almunshaa', NULL);


--
-- Data for Name: login_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.login_logs VALUES (1, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin@fanni.app', 'admin', true, NULL, '::1', 'curl/8.14.1', '2026-04-23 14:52:30.07716+00');
INSERT INTO public.login_logs VALUES (2, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin@fanni.app', 'admin', true, NULL, '::1', 'curl/8.14.1', '2026-04-23 14:52:38.58418+00');
INSERT INTO public.login_logs VALUES (3, 'b0b499c5-3337-4bf7-8f79-6a991436dca7', '01099887766', 'client', false, 'invalid_password', '::1', 'curl/8.14.1', '2026-04-23 14:53:25.391798+00');
INSERT INTO public.login_logs VALUES (4, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin@fanni.app', 'admin', true, NULL, '::1', 'curl/8.14.1', '2026-04-23 14:53:25.490914+00');
INSERT INTO public.login_logs VALUES (5, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin@fanni.app', 'admin', true, NULL, '::1', 'curl/8.14.1', '2026-04-23 14:53:39.176904+00');
INSERT INTO public.login_logs VALUES (6, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '185.98.171.239, 10.81.10.17, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 21:13:00.616297+00');
INSERT INTO public.login_logs VALUES (7, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '154.180.36.152, 10.81.2.26, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 21:16:41.538832+00');
INSERT INTO public.login_logs VALUES (8, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', false, 'invalid_password', '35.188.201.182, 10.81.11.165, 127.0.0.1', 'curl/8.14.1', '2026-04-23 21:42:03.546457+00');
INSERT INTO public.login_logs VALUES (9, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', false, 'invalid_password', '35.188.201.182, 10.81.11.165, 127.0.0.1', 'curl/8.14.1', '2026-04-23 21:42:07.641328+00');
INSERT INTO public.login_logs VALUES (10, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin@fanni.app', 'admin', true, NULL, '35.188.201.182, 10.81.11.165, 127.0.0.1', 'curl/8.14.1', '2026-04-23 21:42:12.97551+00');
INSERT INTO public.login_logs VALUES (11, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '35.188.201.182, 10.81.11.165, 127.0.0.1', 'curl/8.14.1', '2026-04-23 21:42:17.490585+00');
INSERT INTO public.login_logs VALUES (12, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '35.188.201.182, 10.81.11.165, 127.0.0.1', 'curl/8.14.1', '2026-04-23 21:42:24.085613+00');
INSERT INTO public.login_logs VALUES (13, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '185.132.179.140, 10.81.8.156, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 22:21:37.45258+00');
INSERT INTO public.login_logs VALUES (14, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', false, 'invalid_password', '185.132.179.140, 10.81.8.156, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 22:23:30.410558+00');
INSERT INTO public.login_logs VALUES (15, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '185.132.179.140, 10.81.8.156, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 22:23:50.589072+00');
INSERT INTO public.login_logs VALUES (16, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '185.132.179.140, 10.81.8.156, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 22:24:23.235443+00');
INSERT INTO public.login_logs VALUES (17, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '185.132.179.140, 10.81.8.156, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 22:24:54.164867+00');
INSERT INTO public.login_logs VALUES (18, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '167.235.122.119, 10.81.5.86, 127.0.0.1', 'Expo/54.0.6 CFNetwork/3860.300.31 Darwin/25.2.0', '2026-04-23 23:10:38.269192+00');
INSERT INTO public.login_logs VALUES (19, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '185.132.179.140, 10.81.8.156, 127.0.0.1', 'okhttp/4.12.0', '2026-04-23 23:11:34.074262+00');
INSERT INTO public.login_logs VALUES (20, NULL, '010123456789', NULL, false, 'user_not_found', '146.70.246.132, 10.81.1.225, 127.0.0.1', 'okhttp/4.12.0', '2026-04-24 11:31:52.498608+00');
INSERT INTO public.login_logs VALUES (21, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '146.70.246.132, 10.81.1.225, 127.0.0.1', 'okhttp/4.12.0', '2026-04-24 11:32:40.641447+00');
INSERT INTO public.login_logs VALUES (22, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '146.70.246.150, 10.81.14.70, 127.0.0.1', 'okhttp/4.12.0', '2026-04-24 18:45:17.899758+00');
INSERT INTO public.login_logs VALUES (23, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '146.70.246.150, 10.81.14.70, 127.0.0.1', 'okhttp/4.12.0', '2026-04-24 18:45:47.82571+00');
INSERT INTO public.login_logs VALUES (24, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '146.70.246.132, 10.81.12.248, 127.0.0.1', 'okhttp/4.12.0', '2026-04-24 18:46:44.48952+00');
INSERT INTO public.login_logs VALUES (25, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '146.70.246.132, 10.81.3.99, 127.0.0.1', 'okhttp/4.12.0', '2026-04-25 17:04:55.667122+00');
INSERT INTO public.login_logs VALUES (26, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '195.242.214.36, 10.81.12.248, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 22:15:43.898662+00');
INSERT INTO public.login_logs VALUES (27, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '195.242.214.36, 10.81.1.225, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 22:57:04.247963+00');
INSERT INTO public.login_logs VALUES (28, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '195.242.214.36, 10.81.1.225, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 23:00:21.248265+00');
INSERT INTO public.login_logs VALUES (29, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '195.242.214.36, 10.81.10.104, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 23:04:42.535244+00');
INSERT INTO public.login_logs VALUES (30, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '195.242.214.36, 10.81.10.104, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 23:06:55.663992+00');
INSERT INTO public.login_logs VALUES (31, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '195.242.214.36, 10.81.11.165, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 23:19:47.776883+00');
INSERT INTO public.login_logs VALUES (32, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', false, 'invalid_password', '195.242.214.36, 10.81.11.165, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 23:26:48.324891+00');
INSERT INTO public.login_logs VALUES (33, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', '01298765432', 'client', true, NULL, '195.242.214.36, 10.81.11.165, 127.0.0.1', 'okhttp/4.12.0', '2026-04-26 23:27:00.067313+00');
INSERT INTO public.login_logs VALUES (34, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '185.177.124.224, 10.81.1.44, 127.0.0.1', 'okhttp/4.12.0', '2026-04-29 13:17:16.834854+00');
INSERT INTO public.login_logs VALUES (35, '08588777-1bec-43f1-a3f7-7b0ff70faf79', '01001001001', 'admin', true, NULL, '185.177.124.224, 10.81.1.44, 127.0.0.1', 'okhttp/4.12.0', '2026-04-29 13:28:52.47764+00');
INSERT INTO public.login_logs VALUES (36, '3e00499d-f630-42af-a987-31604623ad77', '01174185296', 'client', true, NULL, '185.177.124.224, 10.81.14.74, 127.0.0.1', 'okhttp/4.12.0', '2026-04-29 13:36:24.244742+00');
INSERT INTO public.login_logs VALUES (37, '1d2b4810-c915-4b5e-acb4-be1b2ecd583f', '01215935786', 'technician', true, NULL, '154.180.120.231, 10.81.4.137, 127.0.0.1', 'okhttp/4.12.0', '2026-04-29 13:41:15.553206+00');
INSERT INTO public.login_logs VALUES (38, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', false, 'invalid_password', '185.177.124.199, 10.81.6.70, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 15:05:30.040733+00');
INSERT INTO public.login_logs VALUES (39, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '185.177.124.199, 10.81.6.70, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 15:05:58.290535+00');
INSERT INTO public.login_logs VALUES (40, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:51:09.591591+00');
INSERT INTO public.login_logs VALUES (41, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:51:37.334683+00');
INSERT INTO public.login_logs VALUES (42, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:51:49.794009+00');
INSERT INTO public.login_logs VALUES (43, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:52:04.462193+00');
INSERT INTO public.login_logs VALUES (44, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:52:36.543583+00');
INSERT INTO public.login_logs VALUES (45, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', false, 'invalid_password', '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:52:52.622521+00');
INSERT INTO public.login_logs VALUES (46, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', true, NULL, '217.138.213.6, 10.81.2.200, 127.0.0.1', 'okhttp/4.12.0', '2026-05-06 19:53:00.658227+00');
INSERT INTO public.login_logs VALUES (47, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', false, 'invalid_password', '169.150.197.101, 10.81.0.205, 10.48.164.76, 127.0.0.1', 'okhttp/4.12.0', '2026-05-31 18:12:46.442937+00');
INSERT INTO public.login_logs VALUES (48, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '169.150.197.101, 10.81.0.205, 10.48.190.90, 127.0.0.1', 'okhttp/4.12.0', '2026-05-31 18:13:16.832368+00');
INSERT INTO public.login_logs VALUES (49, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', '01098765432', 'client', true, NULL, '195.242.214.22, 10.81.14.138, 10.48.3.13, 127.0.0.1', 'okhttp/4.12.0', '2026-05-31 23:59:51.527178+00');
INSERT INTO public.login_logs VALUES (50, '17566df4-08e4-4965-a0df-2baf6e90149f', '01012312312', 'technician', true, NULL, '154.180.240.45, 10.81.17.59, 10.48.164.76, 127.0.0.1', 'okhttp/4.12.0', '2026-06-01 00:02:02.021208+00');
INSERT INTO public.login_logs VALUES (51, 'f17eecb4-9316-495d-9dc0-fa3efda9d54d', '01012345678', 'technician', false, 'invalid_password', '185.177.126.151, 10.81.0.248, 10.48.4.75, 127.0.0.1', 'okhttp/4.12.0', '2026-06-22 11:47:57.87708+00');
INSERT INTO public.login_logs VALUES (52, 'c5498cfd-3134-4bb9-8271-d7cf5ca8a641', '01212345678', 'technician', true, NULL, '185.177.126.151, 10.81.0.248, 10.48.6.211, 127.0.0.1', 'okhttp/4.12.0', '2026-06-22 11:48:06.28434+00');
INSERT INTO public.login_logs VALUES (53, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '185.177.126.151, 10.81.0.248, 10.48.3.184, 127.0.0.1', 'okhttp/4.12.0', '2026-06-22 11:49:49.210451+00');
INSERT INTO public.login_logs VALUES (54, 'f9196714-78a9-45bc-9457-20091ad18675', 'admin', 'admin', true, NULL, '169.150.196.119, 10.81.0.228, 10.48.3.35, 127.0.0.1', 'okhttp/4.12.0', '2026-06-23 08:53:59.980252+00');


--
-- Data for Name: nominatim_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.nominatim_cache VALUES ('2937676b-a359-4d5f-bb46-47a7ea025204', 'reverse:ar:31.20010:29.91870', 'ar', '{"lat": "31.1993763", "lon": "29.9185690", "name": "", "type": "house", "class": "place", "osm_id": 6969249117, "address": {"city": "الإسكندرية", "road": "ميدان الدكتور احمد زويل", "state": "الإسكندرية", "hamlet": "الشاطبى", "country": "مصر", "postcode": "21526", "country_code": "eg", "house_number": "77", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48812575, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1993263", "31.1994263", "29.9185190", "29.9186190"], "display_name": "77, ميدان الدكتور احمد زويل, الشاطبى, الإسكندرية, 21526, مصر"}', '2026-04-23 13:39:42.138759+00', '2026-05-23 13:39:42.136+00');
INSERT INTO public.nominatim_cache VALUES ('9689a612-da54-4b1a-843f-726166afed5c', 'reverse:en:31.20010:29.91870', 'en', '{"lat": "31.1993763", "lon": "29.9185690", "name": "", "type": "house", "class": "place", "osm_id": 6969249117, "address": {"city": "Alexandria", "road": "Al Doctor Ahmed Zewil Square", "state": "Alexandria", "hamlet": "Shatby", "country": "Egypt", "postcode": "21526", "country_code": "eg", "house_number": "77", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 47736521, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1993263", "31.1994263", "29.9185190", "29.9186190"], "display_name": "77, Al Doctor Ahmed Zewil Square, Shatby, Alexandria, 21526, Egypt"}', '2026-04-23 13:39:54.828459+00', '2026-05-23 13:39:54.827+00');
INSERT INTO public.nominatim_cache VALUES ('1e18d730-f666-477a-b981-3ed9c7639155', 'streets:ar:alexandria__al_mandara:جمال', 'ar', '[{"lat": "31.2751144", "lon": "30.0065725", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 387290868, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "71618", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43157332, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2699550", "31.2797529", "30.0016695", "30.0120028"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 71618, مصر"}, {"lat": "31.2624979", "lon": "29.9936125", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 691485122, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21221", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42937576, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2591417", "31.2658418", "29.9890436", "29.9982071"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21221, مصر"}, {"lat": "31.2664532", "lon": "29.9991845", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 387290867, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42886254, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2656734", "31.2674128", "29.9980510", "30.0001900"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2687243", "lon": "30.0010647", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 760586155, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42666049, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2675271", "31.2699583", "30.0002805", "30.0017723"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2812415", "lon": "30.0128066", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 228608454, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43632565, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2809568", "31.2814273", "30.0125412", "30.0131468"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2804129", "lon": "30.0120312", "name": "شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742124349, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43457236, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801842", "31.2806415", "30.0117382", "30.0123242"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2802239", "lon": "30.0126579", "name": "شارع متفرع من شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742434565, "address": {"road": "شارع متفرع من شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42877191, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801321", "31.2803710", "30.0123145", "30.0129908"], "display_name": "شارع متفرع من شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}]', '2026-04-25 17:05:52.332406+00', '2026-05-02 17:05:52.331+00');
INSERT INTO public.nominatim_cache VALUES ('901dcb16-7be8-4b42-a061-18a8c50fc754', 'streets:ar:alexandria__al_mandara:جمال ع', 'ar', '[{"lat": "31.2751144", "lon": "30.0065725", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 387290868, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "71618", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43995570, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2699550", "31.2797529", "30.0016695", "30.0120028"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 71618, مصر"}, {"lat": "31.2624979", "lon": "29.9936125", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 691485122, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21221", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43839668, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2591417", "31.2658418", "29.9890436", "29.9982071"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21221, مصر"}, {"lat": "31.2664532", "lon": "29.9991845", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 387290867, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43778663, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2656734", "31.2674128", "29.9980510", "30.0001900"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2687243", "lon": "30.0010647", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 760586155, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43571061, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2675271", "31.2699583", "30.0002805", "30.0017723"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2812415", "lon": "30.0128066", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 228608454, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43893848, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2809568", "31.2814273", "30.0125412", "30.0131468"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2804129", "lon": "30.0120312", "name": "شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742124349, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44041180, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801842", "31.2806415", "30.0117382", "30.0123242"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2802239", "lon": "30.0126579", "name": "شارع متفرع من شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742434565, "address": {"road": "شارع متفرع من شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43925810, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801321", "31.2803710", "30.0123145", "30.0129908"], "display_name": "شارع متفرع من شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}]', '2026-04-25 17:05:53.519978+00', '2026-05-02 17:05:53.519+00');
INSERT INTO public.nominatim_cache VALUES ('0993de22-48a3-4518-8107-f3237e63ad3a', 'streets:ar:alexandria__al_mandara:جمال عبد', 'ar', '[{"lat": "31.2751144", "lon": "30.0065725", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 387290868, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "71618", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42737458, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2699550", "31.2797529", "30.0016695", "30.0120028"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 71618, مصر"}, {"lat": "31.2624979", "lon": "29.9936125", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 691485122, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21221", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42774976, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2591417", "31.2658418", "29.9890436", "29.9982071"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21221, مصر"}, {"lat": "31.2664532", "lon": "29.9991845", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 387290867, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42849897, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2656734", "31.2674128", "29.9980510", "30.0001900"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2687243", "lon": "30.0010647", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 760586155, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42695587, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2675271", "31.2699583", "30.0002805", "30.0017723"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2812415", "lon": "30.0128066", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 228608454, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42672886, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2809568", "31.2814273", "30.0125412", "30.0131468"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2804129", "lon": "30.0120312", "name": "شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742124349, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42809026, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801842", "31.2806415", "30.0117382", "30.0123242"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2802239", "lon": "30.0126579", "name": "شارع متفرع من شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742434565, "address": {"road": "شارع متفرع من شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42665895, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801321", "31.2803710", "30.0123145", "30.0129908"], "display_name": "شارع متفرع من شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}]', '2026-04-25 17:05:54.951493+00', '2026-05-02 17:05:54.95+00');
INSERT INTO public.nominatim_cache VALUES ('ecdd5cbd-13fd-4853-8417-322ceededf73', 'streets:ar:alexandria__al_mandara:جمال عبد الناصر', 'ar', '[{"lat": "31.2751144", "lon": "30.0065725", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 387290868, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "71618", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43157332, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2699550", "31.2797529", "30.0016695", "30.0120028"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 71618, مصر"}, {"lat": "31.2624979", "lon": "29.9936125", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 691485122, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21221", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42937576, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2591417", "31.2658418", "29.9890436", "29.9982071"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21221, مصر"}, {"lat": "31.2664532", "lon": "29.9991845", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 387290867, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "neighbourhood": "مدينة الضباط بسيدي بشر", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42886254, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2656734", "31.2674128", "29.9980510", "30.0001900"], "display_name": "شارع جمال عبد الناصر, مدينة الضباط بسيدي بشر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2687243", "lon": "30.0010647", "name": "شارع جمال عبد الناصر", "type": "unclassified", "class": "highway", "osm_id": 760586155, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21614", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42666049, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2675271", "31.2699583", "30.0002805", "30.0017723"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 21614, مصر"}, {"lat": "31.2812415", "lon": "30.0128066", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 228608454, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43632565, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2809568", "31.2814273", "30.0125412", "30.0131468"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2804129", "lon": "30.0120312", "name": "شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742124349, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43457236, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801842", "31.2806415", "30.0117382", "30.0123242"], "display_name": "شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2802239", "lon": "30.0126579", "name": "شارع متفرع من شارع جمال عبد الناصر", "type": "residential", "class": "highway", "osm_id": 742434565, "address": {"road": "شارع متفرع من شارع جمال عبد الناصر", "state": "الإسكندرية", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42877191, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2801321", "31.2803710", "30.0123145", "30.0129908"], "display_name": "شارع متفرع من شارع جمال عبد الناصر, المندرة, الإسكندرية, 21919, مصر"}]', '2026-04-25 17:05:56.456434+00', '2026-05-02 17:05:56.454+00');
INSERT INTO public.nominatim_cache VALUES ('b64453b7-90f3-4b68-9f16-afbbe39b5ff4', 'streets:ar:alexandria__al_ibrahimeyah:قلي', 'ar', '[]', '2026-04-29 13:07:14.165184+00', '2026-05-29 13:07:14.164+00');
INSERT INTO public.nominatim_cache VALUES ('ed6c716f-697c-421a-9224-14e7011a3e8a', 'streets:ar:alexandria__al_ibrahimeyah:منو', 'ar', '[]', '2026-04-29 13:07:20.953978+00', '2026-05-29 13:07:20.953+00');
INSERT INTO public.nominatim_cache VALUES ('282ad636-e37b-4496-938b-9a27d2ef3fbe', 'streets:ar:alexandria__al_ibrahimeyah:زقا', 'ar', '[]', '2026-04-29 13:07:27.07677+00', '2026-05-29 13:07:27.076+00');
INSERT INTO public.nominatim_cache VALUES ('f11ac66d-541f-4165-ae3a-62d301f403ce', 'geocode:en:al mandara, alexandria, egypt', 'en', '[{"lat": "31.2790537", "lon": "30.0130858", "name": "شارع مسجد المندره", "type": "residential", "class": "highway", "osm_id": 692017092, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42535841, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2787273", "31.2793797", "30.0126937", "30.0134776"], "display_name": "شارع مسجد المندره, ميامي, المندرة, الإسكندرية, 21919, مصر"}]', '2026-04-25 17:06:16.092824+00', '2026-05-25 17:06:16.092+00');
INSERT INTO public.nominatim_cache VALUES ('86ad1de1-993a-4af0-b670-ca2fe0479477', 'streets:ar:alexandria__agamy:شار', 'ar', '[{"lat": "31.1322837", "lon": "29.7877282", "name": "شارع البطل احمد عبد العزيز", "type": "residential", "class": "highway", "osm_id": 653762655, "address": {"road": "شارع البطل احمد عبد العزيز", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43118179, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1288238", "31.1370439", "29.7832496", "29.7933930"], "display_name": "شارع البطل احمد عبد العزيز, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1309505", "lon": "29.7832213", "name": "شارع بلبيس", "type": "residential", "class": "highway", "osm_id": 585560153, "address": {"road": "شارع بلبيس", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43358555, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1278505", "31.1347639", "29.7808813", "29.7838683"], "display_name": "شارع بلبيس, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1295667", "lon": "29.7860797", "name": "شارع العقاري", "type": "residential", "class": "highway", "osm_id": 750262192, "address": {"road": "شارع العقاري", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43060540, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1281486", "31.1317022", "29.7860405", "29.7875334"], "display_name": "شارع العقاري, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1368390", "lon": "29.7831729", "name": "شارع ضباط القوات المسلحه", "type": "residential", "class": "highway", "osm_id": 585560155, "address": {"road": "شارع ضباط القوات المسلحه", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43030033, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1347639", "31.1389525", "29.7827956", "29.7840059"], "display_name": "شارع ضباط القوات المسلحه, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1341209", "lon": "29.7819353", "name": "شارع دكتور كمال خليفه", "type": "residential", "class": "highway", "osm_id": 653762675, "address": {"road": "شارع دكتور كمال خليفه", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43002792, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1334345", "31.1349607", "29.7807049", "29.7831695"], "display_name": "شارع دكتور كمال خليفه, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1328880", "lon": "29.7819029", "name": "شارع 6", "type": "residential", "class": "highway", "osm_id": 693549932, "address": {"road": "شارع 6", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43061177, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1320437", "31.1336407", "29.7811775", "29.7827292"], "display_name": "شارع 6, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1294711", "lon": "29.7808915", "name": "شارع سمر مون", "type": "residential", "class": "highway", "osm_id": 693509284, "address": {"road": "شارع سمر مون", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43684461, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1288599", "31.1302086", "29.7801887", "29.7817073"], "display_name": "شارع سمر مون, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1298747", "lon": "29.7777373", "name": "شارع فندق قصر العجمى", "type": "residential", "class": "highway", "osm_id": 753704928, "address": {"road": "شارع فندق قصر العجمى", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 46277818, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1292508", "31.1304987", "29.7769323", "29.7785423"], "display_name": "شارع فندق قصر العجمى, العجمى, العجمي, الإسكندرية, 00203, مصر"}]', '2026-04-26 08:51:02.993081+00', '2026-05-03 08:51:02.991+00');
INSERT INTO public.nominatim_cache VALUES ('b06a85e9-2d4d-4fce-9a64-bc6e1ccb1561', 'streets:ar:alexandria__agamy:شارع', 'ar', '[{"lat": "31.1328178", "lon": "29.7903388", "name": "شارع الميناء", "type": "unclassified", "class": "highway", "osm_id": 653538357, "address": {"road": "شارع الميناء", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43532351, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1184282", "31.1473143", "29.7838946", "29.7995075"], "display_name": "شارع الميناء, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1309505", "lon": "29.7832213", "name": "شارع بلبيس", "type": "residential", "class": "highway", "osm_id": 585560153, "address": {"road": "شارع بلبيس", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42933485, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1278505", "31.1347639", "29.7808813", "29.7838683"], "display_name": "شارع بلبيس, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1293997", "lon": "29.7847341", "name": "شارع مسجد السلام", "type": "residential", "class": "highway", "osm_id": 653533381, "address": {"road": "شارع مسجد السلام", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42829046, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1280621", "31.1306438", "29.7830996", "29.7862639"], "display_name": "شارع مسجد السلام, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1328880", "lon": "29.7819029", "name": "شارع 6", "type": "residential", "class": "highway", "osm_id": 693549932, "address": {"road": "شارع 6", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43000287, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1320437", "31.1336407", "29.7811775", "29.7827292"], "display_name": "شارع 6, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1333074", "lon": "29.7882514", "name": "شارع امنمحات الاول", "type": "residential", "class": "highway", "osm_id": 653533364, "address": {"road": "شارع امنمحات الاول", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42908017, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1324076", "31.1340637", "29.7875817", "29.7890766"], "display_name": "شارع امنمحات الاول, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1296984", "lon": "29.7775413", "name": "شارع مغسله الفردوس", "type": "residential", "class": "highway", "osm_id": 753704927, "address": {"road": "شارع مغسله الفردوس", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42839541, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1290600", "31.1303369", "29.7767445", "29.7783381"], "display_name": "شارع مغسله الفردوس, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1341751", "lon": "29.7842456", "name": "شارع زايد", "type": "residential", "class": "highway", "osm_id": 692770340, "address": {"road": "شارع زايد", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43111843, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1335119", "31.1349134", "29.7835981", "29.7849711"], "display_name": "شارع زايد, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1316466", "lon": "29.7792615", "name": "شارع سينا", "type": "residential", "class": "highway", "osm_id": 653726924, "address": {"road": "شارع سينا", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42794878, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1309855", "31.1322941", "29.7786105", "29.7798988"], "display_name": "شارع سينا, العجمى, العجمي, الإسكندرية, 00203, مصر"}]', '2026-04-26 08:51:03.749323+00', '2026-05-03 08:51:03.747+00');
INSERT INTO public.nominatim_cache VALUES ('1412ee7e-35dc-47c6-b94c-b68fd56fbb3b', 'streets:ar:alexandria__agamy:شارع ال', 'ar', '[{"lat": "31.1359660", "lon": "29.7854382", "name": "شارع الشناوي", "type": "residential", "class": "highway", "osm_id": 653762645, "address": {"road": "شارع الشناوي", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48819874, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1346510", "31.1371542", "29.7841765", "29.7865725"], "display_name": "شارع الشناوي, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1249264", "lon": "29.7793581", "name": "شارع البكوات", "type": "residential", "class": "highway", "osm_id": 653713915, "address": {"road": "شارع البكوات", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48867062, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1237244", "31.1261708", "29.7783854", "29.7807698"], "display_name": "شارع البكوات, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1276088", "lon": "29.7834916", "name": "شارع على الزنكلونى", "type": "residential", "class": "highway", "osm_id": 692030559, "address": {"road": "شارع على الزنكلونى", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48832133, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1266508", "31.1285276", "29.7822940", "29.7846505"], "display_name": "شارع على الزنكلونى, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1329932", "lon": "29.7849509", "name": "شارع سيف النصر", "type": "residential", "class": "highway", "osm_id": 653762682, "address": {"road": "شارع سيف النصر", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48632103, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1323606", "31.1339795", "29.7837034", "29.7862225"], "display_name": "شارع سيف النصر, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1259475", "lon": "29.7836347", "name": "شارع يس", "type": "residential", "class": "highway", "osm_id": 692030571, "address": {"road": "شارع يس", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48803644, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1251629", "31.1267528", "29.7824603", "29.7847992"], "display_name": "شارع يس, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1270774", "lon": "29.7740994", "name": "شارع 12", "type": "residential", "class": "highway", "osm_id": 693041898, "address": {"road": "شارع 12", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48868224, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1262234", "31.1279510", "29.7730966", "29.7750853"], "display_name": "شارع 12, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1328622", "lon": "29.7860468", "name": "شارع سقاره", "type": "residential", "class": "highway", "osm_id": 653762681, "address": {"road": "شارع سقاره", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48828103, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1320777", "31.1337393", "29.7852907", "29.7868891"], "display_name": "شارع سقاره, العجمى, العجمي, الإسكندرية, 00203, مصر"}, {"lat": "31.1233449", "lon": "29.7882191", "name": "شارع مسجد السلام", "type": "residential", "class": "highway", "osm_id": 692030599, "address": {"road": "شارع مسجد السلام", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48771188, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1227610", "31.1239912", "29.7873199", "29.7891577"], "display_name": "شارع مسجد السلام, العجمى, العجمي, الإسكندرية, 00203, مصر"}]', '2026-04-26 08:51:04.731088+00', '2026-05-03 08:51:04.73+00');
INSERT INTO public.nominatim_cache VALUES ('f0f8a191-675c-46b9-ab54-540ad40aa4c6', 'streets:ar:alexandria__agamy:شارع الحد', 'ar', '[]', '2026-04-26 08:51:05.374307+00', '2026-05-03 08:51:05.373+00');
INSERT INTO public.nominatim_cache VALUES ('684f7a62-5ae0-4273-916c-86a154020ced', 'streets:ar:alexandria__agamy:الحد', 'ar', '[]', '2026-04-26 08:51:10.500814+00', '2026-05-03 08:51:10.5+00');
INSERT INTO public.nominatim_cache VALUES ('ce354bc2-396c-4a64-993f-8aa8dc003a40', 'streets:ar:alexandria__agamy:الحدي', 'ar', '[{"lat": "31.1157916", "lon": "29.7906188", "name": "شارع الهدي", "type": "residential", "class": "highway", "osm_id": 653526928, "address": {"city": "الإسكندرية", "road": "شارع الهدي", "state": "الإسكندرية", "country": "مصر", "postcode": "21928", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43175239, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1144972", "31.1169245", "29.7892482", "29.7918459"], "display_name": "شارع الهدي, العجمى, الإسكندرية, 21928, مصر"}, {"lat": "31.1216210", "lon": "29.7823049", "name": "شارع الهدي", "type": "residential", "class": "highway", "osm_id": 692035623, "address": {"road": "شارع الهدي", "state": "الإسكندرية", "country": "مصر", "postcode": "00203", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44106758, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1208027", "31.1225335", "29.7813687", "29.7833253"], "display_name": "شارع الهدي, العجمى, الإسكندرية, 00203, مصر"}, {"lat": "31.1160106", "lon": "29.7855283", "name": "شارع مسجد الهدي", "type": "residential", "class": "highway", "osm_id": 754032477, "address": {"city": "الإسكندرية", "road": "شارع مسجد الهدي", "state": "الإسكندرية", "country": "مصر", "postcode": "21928", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43079404, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1148592", "31.1169472", "29.7848945", "29.7864831"], "display_name": "شارع مسجد الهدي, العجمى, الإسكندرية, 21928, مصر"}, {"lat": "31.1065869", "lon": "29.7898800", "name": "شارع مسجد نور الهدي", "type": "residential", "class": "highway", "osm_id": 749876572, "address": {"city": "الإسكندرية", "road": "شارع مسجد نور الهدي", "state": "الإسكندرية", "country": "مصر", "postcode": "21928", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43041591, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1059174", "31.1073161", "29.7887414", "29.7909785"], "display_name": "شارع مسجد نور الهدي, العجمى, الإسكندرية, 21928, مصر"}, {"lat": "31.1013417", "lon": "29.7774425", "name": "شارع مسجد الهدي", "type": "residential", "class": "highway", "osm_id": 693750516, "address": {"road": "شارع مسجد الهدي", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44125863, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1011600", "31.1017238", "29.7770168", "29.7778268"], "display_name": "شارع مسجد الهدي, العجمى, الهانوفيل, الإسكندرية, 21575, مصر"}, {"lat": "31.0855520", "lon": "29.7503302", "name": "شارع الهدي", "type": "residential", "class": "highway", "osm_id": 749156698, "address": {"road": "شارع الهدي", "state": "الإسكندرية", "country": "مصر", "postcode": "21644", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44146064, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.0842692", "31.0868999", "29.7491760", "29.7515576"], "display_name": "شارع الهدي, العجمى, الإسكندرية, 21644, مصر"}, {"lat": "31.0848125", "lon": "29.7514210", "name": "شارع الهدى 1", "type": "residential", "class": "highway", "osm_id": 692765892, "address": {"road": "شارع الهدى 1", "state": "الإسكندرية", "country": "مصر", "postcode": "21644", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44091196, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.0844564", "31.0851686", "29.7510604", "29.7517816"], "display_name": "شارع الهدى 1, العجمى, الإسكندرية, 21644, مصر"}, {"lat": "31.0852918", "lon": "29.7512597", "name": "شارع مسجد نور الهدى", "type": "residential", "class": "highway", "osm_id": 692765887, "address": {"road": "شارع مسجد نور الهدى", "state": "الإسكندرية", "country": "مصر", "postcode": "21644", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44245118, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.0850396", "31.0855543", "29.7508257", "29.7516878"], "display_name": "شارع مسجد نور الهدى, العجمى, الإسكندرية, 21644, مصر"}]', '2026-04-26 08:51:13.18886+00', '2026-05-03 08:51:13.188+00');
INSERT INTO public.nominatim_cache VALUES ('cfcdcc30-7eea-4892-b0be-b4ac78bacbbc', 'streets:ar:alexandria__al_ibrahimeyah:الا', 'ar', '[{"lat": "30.7233425", "lon": "31.5686401", "name": "شارع علاء الدين", "type": "residential", "class": "highway", "osm_id": 756353566, "address": {"city": "الابراهيمية", "road": "شارع علاء الدين", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43476486, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7231936", "30.7234914", "31.5685071", "31.5687730"], "display_name": "شارع علاء الدين, الابراهيمية, الشرقية, 44743, مصر"}]', '2026-04-29 13:07:00.55674+00', '2026-05-29 13:07:00.556+00');
INSERT INTO public.nominatim_cache VALUES ('09daf451-f6f7-4d3c-aa6f-51844eea7b1c', 'streets:ar:alexandria__agamy:الحديد', 'ar', '[{"lat": "31.1133946", "lon": "29.7812944", "name": "شارع مساكن الحديد و الصلب", "type": "residential", "class": "highway", "osm_id": 754635269, "address": {"road": "شارع مساكن الحديد و الصلب", "state": "الإسكندرية", "country": "مصر", "postcode": "21575", "country_code": "eg", "neighbourhood": "مساكن الحديد و الصلب", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43394725, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1127176", "31.1141164", "29.7808352", "29.7818641"], "display_name": "شارع مساكن الحديد و الصلب, مساكن الحديد و الصلب, الإسكندرية, 21575, مصر"}, {"lat": "31.1134897", "lon": "29.7821024", "name": "شارع مساكن الحديد و الصلب", "type": "residential", "class": "highway", "osm_id": 754635255, "address": {"road": "شارع مساكن الحديد و الصلب", "state": "الإسكندرية", "country": "مصر", "postcode": "21928", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43158628, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1129627", "31.1139999", "29.7816834", "29.7825009"], "display_name": "شارع مساكن الحديد و الصلب, العجمى, الإسكندرية, 21928, مصر"}, {"lat": "31.0962040", "lon": "29.7576064", "name": "شارع شهرزاد", "type": "unclassified", "class": "highway", "osm_id": 141196944, "address": {"road": "شارع شهرزاد", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "neighbourhood": "مساكن الحديد و الصلب", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42889905, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.0930229", "31.0993642", "29.7543056", "29.7608847"], "display_name": "شارع شهرزاد, مساكن الحديد و الصلب, الهانوفيل, الإسكندرية, 21575, مصر"}, {"lat": "31.0961838", "lon": "29.7575457", "name": "شارع شهرزاد", "type": "unclassified", "class": "highway", "osm_id": 290372766, "address": {"road": "شارع شهرزاد", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43042785, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.0929910", "31.0993353", "29.7542556", "29.7607907"], "display_name": "شارع شهرزاد, العجمى, الهانوفيل, الإسكندرية, 21575, مصر"}, {"lat": "31.1143073", "lon": "29.7950868", "name": "مسجد الحديد والصلب", "type": "place_of_worship", "class": "amenity", "osm_id": 653424102, "address": {"road": "طريق الاسكندرية, مرسى مطروح", "state": "الإسكندرية", "amenity": "مسجد الحديد والصلب", "country": "مصر", "village": "الدخيلة", "postcode": "21575", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43348043, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "amenity", "boundingbox": ["31.1140560", "31.1145126", "29.7948512", "29.7954732"], "display_name": "مسجد الحديد والصلب, طريق الاسكندرية, مرسى مطروح, العجمى, الدخيلة, الإسكندرية, 21575, مصر"}]', '2026-04-26 08:51:14.195242+00', '2026-05-03 08:51:14.194+00');
INSERT INTO public.nominatim_cache VALUES ('41e1de7b-1d05-43ca-b733-6c6b9ec0ffb7', 'streets:ar:alexandria__agamy:ورش', 'ar', '[]', '2026-04-26 08:56:40.199629+00', '2026-05-03 08:56:40.198+00');
INSERT INTO public.nominatim_cache VALUES ('43a15442-40dd-4e7f-9c22-713e63cebd59', 'streets:ar:alexandria__agamy:ورشة', 'ar', '[{"lat": "31.1111161", "lon": "29.7652263", "name": "شارع ورشة البلاط", "type": "residential", "class": "highway", "osm_id": 692671492, "address": {"road": "شارع ورشة البلاط", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43056646, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1080436", "31.1133057", "29.7626631", "29.7684102"], "display_name": "شارع ورشة البلاط, العجمى, الهانوفيل, الإسكندرية, 21575, مصر"}]', '2026-04-26 08:56:43.586003+00', '2026-05-03 08:56:43.585+00');
INSERT INTO public.nominatim_cache VALUES ('667aa655-5790-4e10-bf6a-95936d4b9e0e', 'streets:ar:alexandria__agamy:ورشة البلا', 'ar', '[]', '2026-04-26 08:56:48.369443+00', '2026-05-03 08:56:48.368+00');
INSERT INTO public.nominatim_cache VALUES ('dd67b1d0-ce35-4817-92e9-ccd1ce33f752', 'streets:ar:alexandria__agamy:ورشة البلاط', 'ar', '[{"lat": "31.1111161", "lon": "29.7652263", "name": "شارع ورشة البلاط", "type": "residential", "class": "highway", "osm_id": 692671492, "address": {"road": "شارع ورشة البلاط", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 42885815, "importance": 0.053370834668497714, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.1080436", "31.1133057", "29.7626631", "29.7684102"], "display_name": "شارع ورشة البلاط, العجمى, الهانوفيل, الإسكندرية, 21575, مصر"}]', '2026-04-26 08:56:49.54675+00', '2026-05-03 08:56:49.546+00');
INSERT INTO public.nominatim_cache VALUES ('0b0e512d-febc-4592-99ad-4879017d41cb', 'geocode:en:agamy, alexandria, egypt', 'en', '[{"lat": "31.1126018", "lon": "29.7767224", "name": "العجمى", "type": "neighbourhood", "class": "place", "osm_id": 754208062, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48871002, "importance": 0.08007615091172653, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["31.0809726", "31.1440654", "29.7380042", "29.8262517"], "display_name": "العجمى, الهانوفيل, الإسكندرية, مصر"}]', '2026-04-26 08:57:10.291483+00', '2026-05-26 08:57:10.29+00');
INSERT INTO public.nominatim_cache VALUES ('aaa098b7-a943-4c7c-91e1-34b10cab2f40', 'streets:ar:alexandria__al_ibrahimeyah:الل', 'ar', '[{"lat": "30.7172782", "lon": "31.5628860", "name": "حارة الاحرار", "type": "residential", "class": "highway", "osm_id": 433572661, "address": {"city": "الابراهيمية", "road": "حارة الاحرار", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49344443, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7168505", "30.7177059", "31.5627680", "31.5630044"], "display_name": "حارة الاحرار, KARIM ALY ABDO, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7194466", "lon": "31.5633022", "name": "حارة الجزارين", "type": "residential", "class": "highway", "osm_id": 433576728, "address": {"city": "الابراهيمية", "road": "حارة الجزارين", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49453175, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7190407", "30.7196008", "31.5632938", "31.5635677"], "display_name": "حارة الجزارين, KARIM ALY ABDO, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7198043", "lon": "31.5636038", "name": "حارة ابو نصار", "type": "residential", "class": "highway", "osm_id": 433576290, "address": {"city": "الابراهيمية", "road": "حارة ابو نصار", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49414412, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7197945", "30.7198141", "31.5632701", "31.5639375"], "display_name": "حارة ابو نصار, KARIM ALY ABDO, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7183637", "lon": "31.5578289", "name": "حارة قطوره", "type": "residential", "class": "highway", "osm_id": 433573751, "address": {"road": "حارة قطوره", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49341626, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7177788", "30.7186629", "31.5575652", "31.5583885"], "display_name": "حارة قطوره, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7203020", "lon": "31.5585440", "name": "حارة الطبالين", "type": "residential", "class": "highway", "osm_id": 433571874, "address": {"road": "حارة الطبالين", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49417669, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7194463", "30.7211641", "31.5583842", "31.5587949"], "display_name": "حارة الطبالين, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7178528", "lon": "31.5595827", "name": "حارة بكير", "type": "residential", "class": "highway", "osm_id": 433570276, "address": {"road": "حارة بكير", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49296526, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7177166", "30.7181539", "31.5588659", "31.5603451"], "display_name": "حارة بكير, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7203337", "lon": "31.5611134", "name": "حارة ابو زيد", "type": "residential", "class": "highway", "osm_id": 433577904, "address": {"road": "حارة ابو زيد", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49475027, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7203329", "30.7208415", "31.5609881", "31.5616702"], "display_name": "حارة ابو زيد, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7211937", "lon": "31.5632467", "name": "شارع الجمهوريه", "type": "residential", "class": "highway", "osm_id": 909662388, "address": {"road": "شارع الجمهوريه", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49397204, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7209905", "30.7213494", "31.5628448", "31.5636268"], "display_name": "شارع الجمهوريه, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}]', '2026-04-29 13:06:47.336783+00', '2026-05-29 13:06:47.335+00');
INSERT INTO public.nominatim_cache VALUES ('147086ec-a5ab-4bf1-a373-9a500b844cc0', 'streets:ar:alexandria__al_ibrahimeyah:اللىج', 'ar', '[]', '2026-04-29 13:06:48.637799+00', '2026-05-29 13:06:48.637+00');
INSERT INTO public.nominatim_cache VALUES ('e2266e9a-b963-49e1-b13d-7d71d3f42bef', 'streets:ar:alexandria__al_ibrahimeyah:اللى', 'ar', '[{"lat": "30.7203020", "lon": "31.5585440", "name": "حارة الطبالين", "type": "residential", "class": "highway", "osm_id": 433571874, "address": {"road": "حارة الطبالين", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44854295, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7194463", "30.7211641", "31.5583842", "31.5587949"], "display_name": "حارة الطبالين, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7200871", "lon": "31.5583458", "name": "حارة الملاحين", "type": "residential", "class": "highway", "osm_id": 433572861, "address": {"road": "حارة الملاحين", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44627359, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7194027", "30.7207814", "31.5582628", "31.5584939"], "display_name": "حارة الملاحين, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7222644", "lon": "31.5581676", "name": "حارة عبد الغفار الكثيري", "type": "residential", "class": "highway", "osm_id": 433570311, "address": {"road": "حارة عبد الغفار الكثيري", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44648961, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7217088", "30.7228174", "31.5580748", "31.5582933"], "display_name": "حارة عبد الغفار الكثيري, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7203088", "lon": "31.5620748", "name": "حارة كمال", "type": "residential", "class": "highway", "osm_id": 433570977, "address": {"road": "حارة كمال", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44649327, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7199997", "30.7206179", "31.5620075", "31.5621422"], "display_name": "حارة كمال, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7200305", "lon": "31.5582449", "name": "حارة الجمال", "type": "residential", "class": "highway", "osm_id": 728072370, "address": {"road": "حارة الجمال", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44642116, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7199832", "30.7200778", "31.5578801", "31.5586097"], "display_name": "حارة الجمال, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7185321", "lon": "31.5602058", "name": "حارة بهلول", "type": "residential", "class": "highway", "osm_id": 756522094, "address": {"road": "حارة بهلول", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 45015570, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7184986", "30.7185656", "31.5600053", "31.5604062"], "display_name": "حارة بهلول, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7178528", "lon": "31.5595827", "name": "حارة بكير", "type": "residential", "class": "highway", "osm_id": 433570276, "address": {"road": "حارة بكير", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44384052, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7177166", "30.7181539", "31.5588659", "31.5603451"], "display_name": "حارة بكير, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7181163", "lon": "31.5593134", "name": "حارة الشهيدي", "type": "residential", "class": "highway", "osm_id": 433575262, "address": {"road": "حارة الشهيدي", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44797968, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7180017", "30.7186580", "31.5592763", "31.5598691"], "display_name": "حارة الشهيدي, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}]', '2026-04-29 13:06:49.917942+00', '2026-05-29 13:06:49.917+00');
INSERT INTO public.nominatim_cache VALUES ('7b3cda84-3da7-432b-a420-d67eca18041d', 'streets:ar:alexandria__al_ibrahimeyah:اللىا', 'ar', '[]', '2026-04-29 13:06:51.125101+00', '2026-05-29 13:06:51.124+00');
INSERT INTO public.nominatim_cache VALUES ('13becee4-9f44-4555-8bed-6dadc559072f', 'streets:ar:alexandria__al_ibrahimeyah:اللاج', 'ar', '[]', '2026-04-29 13:06:53.162255+00', '2026-05-29 13:06:53.161+00');
INSERT INTO public.nominatim_cache VALUES ('03c5d77e-fed5-4dd0-94f4-1e947442eb5d', 'streets:ar:alexandria__al_ibrahimeyah:اللاجي', 'ar', '[]', '2026-04-29 13:06:55.581522+00', '2026-05-29 13:06:55.581+00');
INSERT INTO public.nominatim_cache VALUES ('7df16c2f-6905-47a7-90d0-48604e5f684f', 'streets:ar:alexandria__al_ibrahimeyah:اللاجيت', 'ar', '[]', '2026-04-29 13:06:56.718768+00', '2026-05-29 13:06:56.718+00');
INSERT INTO public.nominatim_cache VALUES ('5d579b0a-e4c9-4cae-b425-c8aac163ba45', 'streets:ar:alexandria__al_ibrahimeyah:بور', 'ar', '[]', '2026-04-29 13:07:38.966173+00', '2026-05-29 13:07:38.965+00');
INSERT INTO public.nominatim_cache VALUES ('5d8d9d25-6c4f-4318-9bbb-aaf5dab10681', 'streets:ar:alexandria__al_ibrahimeyah:بورس', 'ar', '[]', '2026-04-29 13:07:40.987951+00', '2026-05-29 13:07:40.987+00');
INSERT INTO public.nominatim_cache VALUES ('5ee38cd4-55fd-4672-ba41-1fce55c1beff', 'streets:ar:alexandria__al_ibrahimeyah:بورسع', 'ar', '[]', '2026-04-29 13:07:42.360038+00', '2026-05-29 13:07:42.359+00');
INSERT INTO public.nominatim_cache VALUES ('ab56ca84-01ad-4049-b0ac-3cc7663b24d5', 'streets:ar:alexandria__al_ibrahimeyah:اللاجيتي', 'ar', '[]', '2026-04-29 13:07:47.212976+00', '2026-05-29 13:07:47.212+00');
INSERT INTO public.nominatim_cache VALUES ('dd3a6038-e975-4de9-922f-ed42406b41c1', 'streets:ar:alexandria__al_ibrahimeyah:اللاجيتية', 'ar', '[]', '2026-04-29 13:07:51.102021+00', '2026-05-29 13:07:51.101+00');
INSERT INTO public.nominatim_cache VALUES ('1c7acc0e-d9b7-46dc-8e99-76d980944cd9', 'geocode:en:al ibrahimeyah, alexandria, egypt', 'en', '[]', '2026-04-29 13:08:26.761957+00', '2026-05-29 13:08:26.761+00');
INSERT INTO public.nominatim_cache VALUES ('f4e4ed85-cdf7-429e-976e-f6813ee7c9fb', 'search:ar:5:عبد', 'ar', '[]', '2026-04-29 13:09:34.78559+00', '2026-05-29 13:09:34.785+00');
INSERT INTO public.nominatim_cache VALUES ('c4132409-de46-4550-b8d4-b2efefe5a0e3', 'search:ar:5:عبد العزيز', 'ar', '[{"lat": "31.2638940", "lon": "32.2552584", "name": "مساكن عمر بن عبد العزيز", "type": "neighbourhood", "class": "place", "osm_id": 757848742, "address": {"city": "بورسعيد", "state": "بورسعيد", "suburb": "مساكن ٥٠٠٠", "country": "مصر", "country_code": "eg", "neighbourhood": "مساكن عمر بن عبد العزيز", "ISO3166-2-lvl4": "EG-PTS"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48255502, "importance": 0.08006320668345156, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["31.2590753", "31.2689339", "32.2497010", "32.2600785"], "display_name": "مساكن عمر بن عبد العزيز, مساكن ٥٠٠٠, بورسعيد, مصر"}, {"lat": "30.5927771", "lon": "31.5249666", "name": "كفر عبد العزيز", "type": "neighbourhood", "class": "place", "osm_id": 758314096, "address": {"city": "الزقازيق", "state": "الشرقية", "suburb": "شوابك بصطا", "country": "مصر", "country_code": "eg", "neighbourhood": "كفر عبد العزيز", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49274595, "importance": 0.08005405737392231, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["30.5858802", "30.5998037", "31.5180670", "31.5300674"], "display_name": "كفر عبد العزيز, شوابك بصطا, الزقازيق, الشرقية, مصر"}, {"lat": "30.0313176", "lon": "31.2258072", "name": "شارع الملك عبد العزيز آل سعود", "type": "secondary", "class": "highway", "osm_id": 53188527, "address": {"city": "القاهرة", "road": "شارع الملك عبد العزيز آل سعود", "state": "القاهرة", "suburb": "المنيل", "country": "مصر", "postcode": "11555", "country_code": "eg", "neighbourhood": "المنيل الغربي", "ISO3166-2-lvl4": "EG-C"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 50387448, "importance": 0.05341293736171508, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.0289602", "30.0336739", "31.2246601", "31.2269403"], "display_name": "شارع الملك عبد العزيز آل سعود, المنيل الغربي, المنيل, القاهرة, 11555, مصر"}, {"lat": "30.0375575", "lon": "31.4042013", "name": "كوبرى البطلة فريال عبد العزيز", "type": "primary", "class": "highway", "osm_id": 1004045953, "address": {"city": "مدينة نصر", "road": "كوبرى البطلة فريال عبد العزيز", "state": "القاهرة", "country": "مصر", "postcode": "11528", "country_code": "eg", "neighbourhood": "عمارات 4000", "ISO3166-2-lvl4": "EG-C"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 50654425, "importance": 0.05341293736171508, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.0373464", "30.0376673", "31.4000104", "31.4083984"], "display_name": "كوبرى البطلة فريال عبد العزيز, عمارات 4000, مدينة نصر, القاهرة, 11528, مصر"}, {"lat": "30.1394076", "lon": "31.3354276", "name": "شارع مصطفى عبد العزيز محمد", "type": "residential", "class": "highway", "osm_id": 688541025, "address": {"city": "شبرا الخيمة", "road": "شارع مصطفى عبد العزيز محمد", "state": "القليوبية", "country": "مصر", "postcode": "11888", "country_code": "eg", "ISO3166-2-lvl4": "EG-KB"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49620504, "importance": 0.05341293736171508, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.1392385", "30.1395766", "31.3347004", "31.3361548"], "display_name": "شارع مصطفى عبد العزيز محمد, شبرا الخيمة, القليوبية, 11888, مصر"}]', '2026-04-29 13:09:37.61321+00', '2026-05-29 13:09:37.612+00');
INSERT INTO public.nominatim_cache VALUES ('f93c9db9-551a-4a20-a36f-065b8fd2960a', 'search:ar:5:عبد العزيز فهمى', 'ar', '[{"lat": "30.1010836", "lon": "31.3498832", "name": "عبد العزيز فهمي", "type": "tram_stop", "class": "railway", "osm_id": 335322488, "address": {"city": "القاهرة", "road": "شارع عبد العزيز فهمى", "state": "القاهرة", "suburb": "مصر الجديدة", "country": "مصر", "railway": "عبد العزيز فهمي", "postcode": "11361", "country_code": "eg", "ISO3166-2-lvl4": "EG-C"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 50720691, "importance": 0.00007960402838173521, "place_rank": 30, "addresstype": "railway", "boundingbox": ["30.1010336", "30.1011336", "31.3498332", "31.3499332"], "display_name": "عبد العزيز فهمي, شارع عبد العزيز فهمى, مصر الجديدة, القاهرة, 11361, مصر"}]', '2026-04-29 13:09:45.615726+00', '2026-05-29 13:09:45.615+00');
INSERT INTO public.nominatim_cache VALUES ('395b4115-9629-4f29-b572-f2d311e4ea08', 'search:ar:5:اللا', 'ar', '[{"lat": "25.4750000", "lon": "32.5161110", "name": "المعلة", "type": "village", "class": "place", "osm_id": 768737307, "address": {"state": "الأقصر", "country": "مصر", "village": "المعلة", "country_code": "eg", "ISO3166-2-lvl4": "EG-LX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48144779, "importance": 0.33935777253266924, "place_rank": 19, "addresstype": "village", "boundingbox": ["25.4550000", "25.4950000", "32.4961110", "32.5361110"], "display_name": "المعلة, الأقصر, مصر"}, {"lat": "25.9833330", "lon": "32.8333330", "name": "نجع الزقيم محافظة عبد الله", "type": "village", "class": "place", "osm_id": 768082581, "address": {"state": "قنا", "country": "مصر", "village": "نجع الزقيم محافظة عبد الله", "country_code": "eg", "ISO3166-2-lvl4": "EG-KN"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 47862285, "importance": 0.14671969253070874, "place_rank": 19, "addresstype": "village", "boundingbox": ["25.9633330", "26.0033330", "32.8133330", "32.8533330"], "display_name": "نجع الزقيم محافظة عبد الله, قنا, مصر"}, {"lat": "30.0554418", "lon": "31.2309436", "name": "ابو العلا", "type": "neighbourhood", "class": "place", "osm_id": 777957181, "address": {"city": "القاهرة", "state": "القاهرة", "suburb": "بولاق", "country": "مصر", "country_code": "eg", "neighbourhood": "ابو العلا", "ISO3166-2-lvl4": "EG-C"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 50378223, "importance": 0.08007960402838175, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["30.0534365", "30.0572745", "31.2281884", "31.2335761"], "display_name": "ابو العلا, بولاق, القاهرة, مصر"}, {"lat": "30.4415348", "lon": "31.2742416", "name": "قريه كفر عطا الله", "type": "administrative", "class": "boundary", "osm_id": 737609917, "address": {"state": "القليوبية", "country": "مصر", "country_code": "eg", "neighbourhood": "قريه كفر عطا الله", "ISO3166-2-lvl4": "EG-KB"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49623979, "importance": 0.0667203242542153, "place_rank": 25, "addresstype": "neighbourhood", "boundingbox": ["30.4340819", "30.4489512", "31.2506921", "31.2801454"], "display_name": "قريه كفر عطا الله, القليوبية, مصر"}, {"lat": "30.1263678", "lon": "31.3180417", "name": "شارع عبد العزيز ابو العلا", "type": "residential", "class": "highway", "osm_id": 34145879, "address": {"city": "القاهرة", "road": "شارع عبد العزيز ابو العلا", "state": "القاهرة", "suburb": "عين شمس", "country": "مصر", "postcode": "11782", "country_code": "eg", "ISO3166-2-lvl4": "EG-C"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49944303, "importance": 0.05341293736171508, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.1258209", "30.1269073", "31.3178577", "31.3182465"], "display_name": "شارع عبد العزيز ابو العلا, عين شمس, القاهرة, 11782, مصر"}]', '2026-04-29 13:09:55.566547+00', '2026-05-29 13:09:55.566+00');
INSERT INTO public.nominatim_cache VALUES ('250e6b75-fa48-4865-8669-7fba252f85ca', 'search:ar:5:اللاجيتي', 'ar', '[]', '2026-04-29 13:09:57.544939+00', '2026-05-29 13:09:57.544+00');
INSERT INTO public.nominatim_cache VALUES ('9fb80bca-fa0f-444d-82eb-3eb2716d453a', 'search:ar:5:اللاجيتية', 'ar', '[]', '2026-04-29 13:10:00.488285+00', '2026-05-29 13:10:00.487+00');
INSERT INTO public.nominatim_cache VALUES ('7deac88f-0b61-4d42-b8b5-1e8cd4d7b93a', 'search:ar:5:الابرا', 'ar', '[]', '2026-04-29 13:10:05.726141+00', '2026-05-29 13:10:05.725+00');
INSERT INTO public.nominatim_cache VALUES ('010756b9-893a-4a2a-a815-526c90b8a04b', 'search:ar:5:الابراه', 'ar', '[]', '2026-04-29 13:10:06.871791+00', '2026-05-29 13:10:06.871+00');
INSERT INTO public.nominatim_cache VALUES ('2ddc6d54-2129-43e9-91b7-0dd672a5f8cc', 'search:ar:5:الابراهي', 'ar', '[]', '2026-04-29 13:10:08.258411+00', '2026-05-29 13:10:08.257+00');
INSERT INTO public.nominatim_cache VALUES ('741606d7-c0bd-45da-99c9-2485af03edfa', 'search:ar:5:الاب', 'ar', '[{"lat": "26.2540493", "lon": "29.2675469", "name": "مصر", "type": "administrative", "class": "boundary", "osm_id": 1473947, "address": {"country": "مصر", "country_code": "eg"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "relation", "place_id": 46863497, "importance": 0.8377043589365253, "place_rank": 4, "addresstype": "country", "boundingbox": ["21.9936018", "31.8330854", "24.6499112", "37.1153517"], "display_name": "مصر"}]', '2026-04-29 13:10:10.521544+00', '2026-05-29 13:10:10.521+00');
INSERT INTO public.nominatim_cache VALUES ('c1b9bcc2-af42-4731-bb25-1faeba6cd153', 'search:ar:5:الا', 'ar', '[{"lat": "27.8644422", "lon": "34.2954470", "name": "شرم الشيخ", "type": "city", "class": "place", "osm_id": 428339450, "address": {"city": "شرم الشيخ", "state": "جنوب سيناء", "country": "مصر", "district": "رأس أم سد", "postcode": "46619", "country_code": "eg", "ISO3166-2-lvl4": "EG-JS"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 42953358, "importance": 0.5746546961544831, "place_rank": 16, "addresstype": "city", "boundingbox": ["27.7044422", "28.0244422", "34.1354470", "34.4554470"], "display_name": "شرم الشيخ, رأس أم سد, جنوب سيناء, 46619, مصر"}, {"lat": "30.6332775", "lon": "31.7893739", "name": "الشرقية", "type": "administrative", "class": "boundary", "osm_id": 4103407, "address": {"state": "الشرقية", "country": "مصر", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "relation", "place_id": 44432223, "importance": 0.525616767572948, "place_rank": 8, "addresstype": "state", "boundingbox": ["30.1979663", "31.0622437", "31.2789568", "32.2255444"], "display_name": "الشرقية, مصر"}, {"lat": "31.3814765", "lon": "30.8513566", "name": "كفر الشيخ", "type": "administrative", "class": "boundary", "osm_id": 4103405, "address": {"state": "كفر الشيخ", "country": "مصر", "country_code": "eg", "ISO3166-2-lvl4": "EG-KFS"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "relation", "place_id": 43662726, "importance": 0.5102168444433652, "place_rank": 8, "addresstype": "state", "boundingbox": ["30.9628538", "31.8004315", "30.2093855", "31.4121374"], "display_name": "كفر الشيخ, مصر"}, {"lat": "23.9802763", "lon": "27.7269966", "name": "الوادي الجديد", "type": "administrative", "class": "boundary", "osm_id": 3061827, "address": {"state": "الوادي الجديد", "country": "مصر", "country_code": "eg", "ISO3166-2-lvl4": "EG-WAD"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "relation", "place_id": 47385184, "importance": 0.4990198087986086, "place_rank": 8, "addresstype": "state", "boundingbox": ["22.0000000", "27.7489122", "24.9969440", "32.7401920"], "display_name": "الوادي الجديد, مصر"}, {"lat": "26.1048360", "lon": "34.2797640", "name": "القصير", "type": "city", "class": "place", "osm_id": 27136155, "address": {"city": "القصير", "state": "البحر الأحمر", "country": "مصر", "postcode": "84712", "country_code": "eg", "ISO3166-2-lvl4": "EG-BA"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 42452376, "importance": 0.4402686161245203, "place_rank": 16, "addresstype": "city", "boundingbox": ["25.9448360", "26.2648360", "34.1197640", "34.4397640"], "display_name": "القصير, البحر الأحمر, 84712, مصر"}]', '2026-04-29 13:10:13.733076+00', '2026-05-29 13:10:13.732+00');
INSERT INTO public.nominatim_cache VALUES ('b8013a42-d223-49e0-9a4a-4f9c971d5c8b', 'search:ar:5:ال', 'ar', '[]', '2026-04-29 13:10:19.095673+00', '2026-05-29 13:10:19.095+00');
INSERT INTO public.nominatim_cache VALUES ('2256494a-c2ff-45e3-b296-63586377bf18', 'search:ar:5:الاسك', 'ar', '[]', '2026-04-29 13:10:20.90742+00', '2026-05-29 13:10:20.907+00');
INSERT INTO public.nominatim_cache VALUES ('07b20118-6c57-4011-a3fa-79f2928bce7e', 'search:ar:5:الاسكن', 'ar', '[{"lat": "25.6934044", "lon": "32.6402001", "name": "الاسكنء انع", "type": "restaurant", "class": "amenity", "osm_id": 11123478105, "address": {"road": "شارع التلفزيون", "state": "الأقصر", "suburb": "مدينه الاقصر", "amenity": "الاسكنء انع", "country": "مصر", "village": "مدينه البياضيه", "postcode": "85951", "country_code": "eg", "house_number": "190", "ISO3166-2-lvl4": "EG-LX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 47545532, "importance": 0.00006485465781638845, "place_rank": 30, "addresstype": "amenity", "boundingbox": ["25.6933544", "25.6934544", "32.6401501", "32.6402501"], "display_name": "الاسكنء انع, 190, شارع التلفزيون, مدينه الاقصر, مدينه البياضيه, الأقصر, 85951, مصر"}]', '2026-04-29 13:10:23.527419+00', '2026-05-29 13:10:23.526+00');
INSERT INTO public.nominatim_cache VALUES ('b18fb62d-9a26-484f-b9c5-ad649a585c9e', 'streets:ar:alexandria__camp_shizar:الحداد', 'ar', '[]', '2026-04-29 13:15:27.191547+00', '2026-05-29 13:15:27.191+00');
INSERT INTO public.nominatim_cache VALUES ('996bd18f-f52a-4887-aa2f-87bc573f0bdf', 'streets:ar:alexandria__al_ibrahimeyah:شارع', 'ar', '[{"lat": "30.7087620", "lon": "31.5597115", "name": "شارع السوق", "type": "residential", "class": "highway", "osm_id": 433579676, "address": {"city": "الابراهيمية", "road": "شارع السوق", "state": "الشرقية", "country": "مصر", "postcode": "44826", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43655828, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7069233", "30.7107266", "31.5583288", "31.5608150"], "display_name": "شارع السوق, الابراهيمية, الشرقية, 44826, مصر"}, {"lat": "30.7135838", "lon": "31.5683986", "name": "شارع صالح عبد الحميد", "type": "residential", "class": "highway", "osm_id": 433576669, "address": {"city": "الابراهيمية", "road": "شارع صالح عبد الحميد", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "عزبة ابو عياد", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43497158, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7125447", "30.7146553", "31.5669464", "31.5698262"], "display_name": "شارع صالح عبد الحميد, عزبة ابو عياد, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7041004", "lon": "31.5588752", "name": "شارع مدرسه الشهيد لطفي بليغ", "type": "unclassified", "class": "highway", "osm_id": 433574929, "address": {"city": "الابراهيمية", "road": "شارع مدرسه الشهيد لطفي بليغ", "state": "الشرقية", "country": "مصر", "postcode": "44826", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43535844, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7029647", "30.7047018", "31.5577049", "31.5603513"], "display_name": "شارع مدرسه الشهيد لطفي بليغ, الابراهيمية, الشرقية, 44826, مصر"}, {"lat": "30.7156367", "lon": "31.5708746", "name": "شارع 1", "type": "residential", "class": "highway", "osm_id": 745696407, "address": {"city": "الابراهيمية", "road": "شارع 1", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43779418, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7147645", "30.7164521", "31.5699531", "31.5718639"], "display_name": "شارع 1, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7171954", "lon": "31.5641092", "name": "شارع المحكمة", "type": "residential", "class": "highway", "osm_id": 433578745, "address": {"city": "الابراهيمية", "road": "شارع المحكمة", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43504358, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7168901", "30.7175703", "31.5638562", "31.5642052"], "display_name": "شارع المحكمة, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7231989", "lon": "31.5675937", "name": "شارع محمد الحنفى", "type": "residential", "class": "highway", "osm_id": 756353569, "address": {"city": "الابراهيمية", "road": "شارع محمد الحنفى", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43500006, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7229785", "30.7234192", "31.5673605", "31.5678269"], "display_name": "شارع محمد الحنفى, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7276858", "lon": "31.5640691", "name": "شارع 8", "type": "residential", "class": "highway", "osm_id": 756353560, "address": {"road": "شارع 8", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "عزبة ابو حسين", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43499595, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7274392", "30.7278349", "31.5633894", "31.5647736"], "display_name": "شارع 8, عزبة ابو حسين, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7207459", "lon": "31.5575212", "name": "شارع الزغلى", "type": "residential", "class": "highway", "osm_id": 727747409, "address": {"road": "شارع الزغلى", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 43501982, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7206924", "30.7207952", "31.5567743", "31.5582628"], "display_name": "شارع الزغلى, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}]', '2026-04-29 13:44:18.253665+00', '2026-05-29 13:44:18.253+00');
INSERT INTO public.nominatim_cache VALUES ('b8e55912-88e7-4e6f-99e3-5d2d42c7e8d2', 'streets:ar:alexandria__al_ibrahimeyah:شارع ابوقيؤ', 'ar', '[]', '2026-04-29 13:44:21.567169+00', '2026-05-29 13:44:21.566+00');
INSERT INTO public.nominatim_cache VALUES ('5f466bc9-cb19-4443-b231-9b4ee527fcc6', 'streets:ar:alexandria__al_ibrahimeyah:شارع ابوقي', 'ar', '[]', '2026-04-29 13:44:24.536307+00', '2026-05-29 13:44:24.535+00');
INSERT INTO public.nominatim_cache VALUES ('0fffff7c-a245-46d5-bb05-04e9ef286e62', 'streets:ar:alexandria__al_ibrahimeyah:شارع ابوقير', 'ar', '[]', '2026-04-29 13:44:26.015565+00', '2026-05-29 13:44:26.015+00');
INSERT INTO public.nominatim_cache VALUES ('a1646ad8-91b0-41d1-8ee9-f6513fec896d', 'streets:ar:alexandria__camp_shizar:شارع بور', 'ar', '[]', '2026-04-29 13:48:15.384513+00', '2026-05-29 13:48:15.384+00');
INSERT INTO public.nominatim_cache VALUES ('da0f0afc-606c-4674-af4f-0dc9434af63f', 'streets:ar:alexandria__camp_shizar:شارع بورسعيد', 'ar', '[]', '2026-04-29 13:48:16.628933+00', '2026-05-29 13:48:16.628+00');
INSERT INTO public.nominatim_cache VALUES ('23ffbfd4-58c3-49cc-bd1a-78839f95029f', 'geocode:en:camp shizar, alexandria, egypt', 'en', '[]', '2026-04-29 13:52:38.691413+00', '2026-05-29 13:52:38.69+00');
INSERT INTO public.nominatim_cache VALUES ('07c3dc2b-7dc3-4324-a92e-86c714e7f1f3', 'streets:ar:alexandria__camp_shizar:شارع اب', 'ar', '[]', '2026-04-29 13:54:01.23732+00', '2026-05-29 13:54:01.236+00');
INSERT INTO public.nominatim_cache VALUES ('ab5eb52a-5ea7-40f6-a60f-abe117b8b2a5', 'streets:ar:alexandria__camp_shizar:شارع ا', 'ar', '[{"lat": "31.2143127", "lon": "29.9445483", "name": "بنك الإتحاد الوطني - مصر", "type": "bank", "class": "amenity", "osm_id": 6419509092, "address": {"city": "الإسكندرية", "road": "شارع اللواء محمد فوزي معاذ", "state": "الإسكندرية", "amenity": "بنك الإتحاد الوطني - مصر", "country": "مصر", "postcode": "21554", "country_code": "eg", "neighbourhood": "كامب شيزار", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 42976274, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "amenity", "boundingbox": ["31.2142627", "31.2143627", "29.9444983", "29.9445983"], "display_name": "بنك الإتحاد الوطني - مصر, شارع اللواء محمد فوزي معاذ, كامب شيزار, الإسكندرية, 21554, مصر"}]', '2026-04-29 13:54:02.156665+00', '2026-05-29 13:54:02.156+00');
INSERT INTO public.nominatim_cache VALUES ('dcfe86a1-52c3-4b56-b124-bb064eef083e', 'streets:ar:alexandria__camp_shizar:شارع ابورسعي', 'ar', '[]', '2026-04-29 13:54:05.756224+00', '2026-05-29 13:54:05.755+00');
INSERT INTO public.nominatim_cache VALUES ('761ee36f-a60d-4569-9d85-27b33a64f0ce', 'streets:ar:alexandria__camp_shizar:شارع ابورسعيد', 'ar', '[]', '2026-04-29 13:54:07.086008+00', '2026-05-29 13:54:07.085+00');
INSERT INTO public.nominatim_cache VALUES ('a91b0b9a-1779-460d-95a0-0d5fd33a51a9', 'streets:ar:alexandria__camp_shizar:شارع بورسعي', 'ar', '[]', '2026-04-29 13:55:22.010117+00', '2026-05-29 13:55:22.009+00');
INSERT INTO public.nominatim_cache VALUES ('07a2b244-406a-4acc-b617-9b5682a7017f', 'streets:ar:alexandria__al_ibrahimeyah:شارع ب', 'ar', '[]', '2026-04-29 13:56:52.869789+00', '2026-05-29 13:56:52.869+00');
INSERT INTO public.nominatim_cache VALUES ('b13fc501-d25f-48be-be45-8d403f21b679', 'streets:ar:alexandria__al_ibrahimeyah:شارع ابو', 'ar', '[{"lat": "30.7200552", "lon": "31.5698780", "name": "شارع ابو دسوقي", "type": "residential", "class": "highway", "osm_id": 433572777, "address": {"city": "الابراهيمية", "road": "شارع ابو دسوقي", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "عزبة ابو دسوقى", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49390555, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7175451", "30.7227125", "31.5674644", "31.5723225"], "display_name": "شارع ابو دسوقي, عزبة ابو دسوقى, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7056197", "lon": "31.5595803", "name": "شارع مسجد ابو تقي", "type": "residential", "class": "highway", "osm_id": 433570936, "address": {"city": "الابراهيمية", "road": "شارع مسجد ابو تقي", "state": "الشرقية", "country": "مصر", "postcode": "44826", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49473975, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7049719", "30.7059939", "31.5591019", "31.5596150"], "display_name": "شارع مسجد ابو تقي, الابراهيمية, الشرقية, 44826, مصر"}, {"lat": "30.7184080", "lon": "31.5643592", "name": "شارع ابو هاشم", "type": "residential", "class": "highway", "osm_id": 740737222, "address": {"city": "الابراهيمية", "road": "شارع ابو هاشم", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49344462, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7183066", "30.7184372", "31.5637324", "31.5649926"], "display_name": "شارع ابو هاشم, KARIM ALY ABDO, الابراهيمية, الشرقية, 44743, مصر"}, {"lat": "30.7045667", "lon": "31.5551410", "name": "شارع مسجد ابو غباني", "type": "residential", "class": "highway", "osm_id": 433573758, "address": {"city": "الابراهيمية", "road": "شارع مسجد ابو غباني", "state": "الشرقية", "country": "مصر", "postcode": "44826", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49500438, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7044834", "30.7046805", "31.5548793", "31.5553913"], "display_name": "شارع مسجد ابو غباني, الابراهيمية, الشرقية, 44826, مصر"}, {"lat": "30.7139735", "lon": "31.5397136", "name": "شارع عزبة ابو موسى العجوز", "type": "residential", "class": "highway", "osm_id": 913130075, "address": {"city": "الابراهيمية", "road": "شارع عزبة ابو موسى العجوز", "state": "الشرقية", "country": "مصر", "postcode": "44776", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49501923, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7138049", "30.7141415", "31.5397069", "31.5397568"], "display_name": "شارع عزبة ابو موسى العجوز, الابراهيمية, الشرقية, 44776, مصر"}, {"lat": "30.7197788", "lon": "31.5579057", "name": "شارع ابو رزق", "type": "residential", "class": "highway", "osm_id": 433571791, "address": {"road": "شارع ابو رزق", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49512142, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7193251", "30.7202222", "31.5578027", "31.5579625"], "display_name": "شارع ابو رزق, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7179954", "lon": "31.5616861", "name": "شارع ابو دقن", "type": "residential", "class": "highway", "osm_id": 433573579, "address": {"road": "شارع ابو دقن", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49491414, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7169388", "30.7190507", "31.5616245", "31.5616866"], "display_name": "شارع ابو دقن, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7171219", "lon": "31.5624233", "name": "شارع ابو يوسف", "type": "residential", "class": "highway", "osm_id": 433571986, "address": {"road": "شارع ابو يوسف", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49293327, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7170663", "30.7171775", "31.5620191", "31.5628274"], "display_name": "شارع ابو يوسف, مدينه الابراهيميه, الشرقية, 44743, مصر"}]', '2026-04-29 13:56:55.725312+00', '2026-05-29 13:56:55.724+00');
INSERT INTO public.nominatim_cache VALUES ('7fd070d1-b067-4443-aeb6-5f50b11d239f', 'reverse:en:31.12438:29.77411', 'en', '{"lat": "31.1244016", "lon": "29.7740449", "name": "", "type": "house", "class": "place", "osm_id": 7067050084, "address": {"road": "Street 13", "state": "Alexandria", "country": "Egypt", "village": "Al Hanuvil", "postcode": "21575", "country_code": "eg", "house_number": "38", "neighbourhood": "Al Agamy", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48884675, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1243516", "31.1244516", "29.7739949", "29.7740949"], "display_name": "38, Street 13, Al Agamy, Al Hanuvil, Alexandria, 21575, Egypt"}', '2026-06-21 21:59:59.310661+00', '2026-07-21 21:59:59.309+00');
INSERT INTO public.nominatim_cache VALUES ('7bc51ea7-ddc3-44e9-b356-dfc225cad085', 'streets:ar:alexandria__al_ibrahimeyah:ابو', 'ar', '[{"lat": "30.7178340", "lon": "31.5682181", "name": "عزبة ابو دسوقى", "type": "neighbourhood", "class": "place", "osm_id": 756647236, "address": {"city": "الابراهيمية", "state": "الشرقية", "country": "مصر", "country_code": "eg", "neighbourhood": "عزبة ابو دسوقى", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44677059, "importance": 0.08005405737392231, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["30.7159114", "30.7198220", "31.5669823", "31.5704724"], "display_name": "عزبة ابو دسوقى, الابراهيمية, الشرقية, مصر"}, {"lat": "30.7140621", "lon": "31.5658771", "name": "عزبة ابو عياد", "type": "neighbourhood", "class": "place", "osm_id": 756647229, "address": {"city": "الابراهيمية", "state": "الشرقية", "country": "مصر", "country_code": "eg", "neighbourhood": "عزبة ابو عياد", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44022031, "importance": 0.08005405737392231, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["30.7117947", "30.7161778", "31.5649475", "31.5671370"], "display_name": "عزبة ابو عياد, الابراهيمية, الشرقية, مصر"}, {"lat": "30.7277764", "lon": "31.5640574", "name": "عزبة ابو حسين", "type": "neighbourhood", "class": "place", "osm_id": 756647237, "address": {"town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "country_code": "eg", "neighbourhood": "عزبة ابو حسين", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44444497, "importance": 0.08005405737392231, "place_rank": 24, "addresstype": "neighbourhood", "boundingbox": ["30.7259647", "30.7294700", "31.5625700", "31.5658584"], "display_name": "عزبة ابو حسين, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, مصر"}, {"lat": "30.7056197", "lon": "31.5595803", "name": "شارع مسجد ابو تقي", "type": "residential", "class": "highway", "osm_id": 433570936, "address": {"city": "الابراهيمية", "road": "شارع مسجد ابو تقي", "state": "الشرقية", "country": "مصر", "postcode": "44826", "country_code": "eg", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44385873, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7049719", "30.7059939", "31.5591019", "31.5596150"], "display_name": "شارع مسجد ابو تقي, الابراهيمية, الشرقية, 44826, مصر"}, {"lat": "30.7203337", "lon": "31.5611134", "name": "حارة ابو زيد", "type": "residential", "class": "highway", "osm_id": 433577904, "address": {"road": "حارة ابو زيد", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44588844, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7203329", "30.7208415", "31.5609881", "31.5616702"], "display_name": "حارة ابو زيد, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7179954", "lon": "31.5616861", "name": "شارع ابو دقن", "type": "residential", "class": "highway", "osm_id": 433573579, "address": {"road": "شارع ابو دقن", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44912228, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7169388", "30.7190507", "31.5616245", "31.5616866"], "display_name": "شارع ابو دقن, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7193071", "lon": "31.5604151", "name": "حارة ابو عامر", "type": "residential", "class": "highway", "osm_id": 756522100, "address": {"road": "حارة ابو عامر", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44542593, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7187787", "30.7198026", "31.5603485", "31.5604629"], "display_name": "حارة ابو عامر, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}, {"lat": "30.7187979", "lon": "31.5576949", "name": "حارة ابو شبانه", "type": "residential", "class": "highway", "osm_id": 433572684, "address": {"road": "حارة ابو شبانه", "town": "مدينه الابراهيميه", "state": "الشرقية", "country": "مصر", "postcode": "44743", "country_code": "eg", "neighbourhood": "KARIM ALY ABDO", "ISO3166-2-lvl4": "EG-SHR"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 44504622, "importance": 0.05338739070725563, "place_rank": 26, "addresstype": "road", "boundingbox": ["30.7183343", "30.7192724", "31.5576586", "31.5577804"], "display_name": "حارة ابو شبانه, KARIM ALY ABDO, مدينه الابراهيميه, الشرقية, 44743, مصر"}]', '2026-04-29 13:57:52.151582+00', '2026-05-29 13:57:52.151+00');
INSERT INTO public.nominatim_cache VALUES ('27ba0d82-3e3e-4cd6-83fc-07e8d128f969', 'streets:ar:alexandria__al_ibrahimeyah:ابو قير', 'ar', '[]', '2026-04-29 13:57:53.555829+00', '2026-05-29 13:57:53.555+00');
INSERT INTO public.nominatim_cache VALUES ('66576b5c-4e82-4d3a-b8a3-3bf8f9b0ad66', 'streets:ar:alexandria__al_ibrahimeyah:ابو قي', 'ar', '[]', '2026-04-29 13:58:08.931175+00', '2026-05-29 13:58:08.93+00');
INSERT INTO public.nominatim_cache VALUES ('e23ebe22-575a-4bd1-978f-c917e3a18a2a', 'streets:ar:alexandria__abu_qir:شارع', 'ar', '[{"lat": "31.2883427", "lon": "30.0313782", "name": "شارع علي حمدي الجمال", "type": "residential", "class": "highway", "osm_id": 35211929, "address": {"road": "شارع علي حمدي الجمال", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48647368, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2867352", "31.2899040", "30.0263778", "30.0363934"], "display_name": "شارع علي حمدي الجمال, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}, {"lat": "31.2861518", "lon": "30.0331667", "name": "شارع الزهراء", "type": "residential", "class": "highway", "osm_id": 28892485, "address": {"road": "شارع الزهراء", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48806355, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2852063", "31.2902918", "30.0287678", "30.0334201"], "display_name": "شارع الزهراء, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}, {"lat": "31.2879854", "lon": "30.0331149", "name": "شارع النصر", "type": "residential", "class": "highway", "osm_id": 35211917, "address": {"road": "شارع النصر", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49128468, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2867332", "31.2892496", "30.0292745", "30.0369536"], "display_name": "شارع النصر, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}, {"lat": "31.2888206", "lon": "30.0349497", "name": "شارع يوسف وانلي", "type": "residential", "class": "highway", "osm_id": 690499352, "address": {"road": "شارع يوسف وانلي", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48924136, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2866824", "31.2909563", "30.0340059", "30.0358878"], "display_name": "شارع يوسف وانلي, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}, {"lat": "31.2867304", "lon": "30.0360383", "name": "شارع 21", "type": "residential", "class": "highway", "osm_id": 35211951, "address": {"road": "شارع 21", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48850448, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2854673", "31.2874224", "30.0342514", "30.0381971"], "display_name": "شارع 21, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}, {"lat": "31.2882690", "lon": "30.0299439", "name": "شارع العطار", "type": "residential", "class": "highway", "osm_id": 35211937, "address": {"road": "شارع العطار", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48806055, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2870597", "31.2894807", "30.0294062", "30.0304867"], "display_name": "شارع العطار, المعمورة الشاطىء, أبو قير, الإسكندرية, 21919, مصر"}, {"lat": "31.2886102", "lon": "30.0309824", "name": "شارع 13", "type": "residential", "class": "highway", "osm_id": 35211935, "address": {"road": "شارع 13", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48932253, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2873911", "31.2898332", "30.0304628", "30.0315120"], "display_name": "شارع 13, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}, {"lat": "31.2882206", "lon": "30.0363453", "name": "شارع نصر الدين", "type": "residential", "class": "highway", "osm_id": 35211956, "address": {"road": "شارع نصر الدين", "town": "أبو قير", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "postcode": "21912", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48930099, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2878912", "31.2885580", "30.0353583", "30.0373295"], "display_name": "شارع نصر الدين, المعمورة الشاطىء, أبو قير, الإسكندرية, 21912, مصر"}]', '2026-06-01 00:01:08.606957+00', '2026-07-01 00:01:08.605+00');
INSERT INTO public.nominatim_cache VALUES ('c9304901-3895-4468-a16c-7af37ea52bac', 'streets:ar:alexandria__abu_qir:شارع جام', 'ar', '[]', '2026-06-01 00:01:09.285263+00', '2026-07-01 00:01:09.284+00');
INSERT INTO public.nominatim_cache VALUES ('c675c6c8-5a20-44d5-a0e0-a1e9aadc967b', 'streets:ar:alexandria__abu_qir:شارع ج', 'ar', '[]', '2026-06-01 00:01:10.118115+00', '2026-07-01 00:01:10.117+00');
INSERT INTO public.nominatim_cache VALUES ('c50ec0de-49b9-482a-ae55-3f7508773d6b', 'streets:ar:alexandria__abu_qir:شارع  واسع', 'ar', '[]', '2026-06-01 00:01:13.108843+00', '2026-07-01 00:01:13.108+00');
INSERT INTO public.nominatim_cache VALUES ('3d7ba327-0227-47a3-a9cf-a3ab0ed646b8', 'streets:ar:alexandria__abu_qir:شارع  واس', 'ar', '[]', '2026-06-01 00:01:16.885396+00', '2026-07-01 00:01:16.884+00');
INSERT INTO public.nominatim_cache VALUES ('7ddad530-7af1-42a4-8d8b-312dc49a5b9c', 'streets:ar:alexandria__al_mamurah:شارع', 'ar', '[{"lat": "31.2877952", "lon": "30.0269606", "name": "شارع 3", "type": "residential", "class": "highway", "osm_id": 35211941, "address": {"road": "شارع 3", "state": "الإسكندرية", "suburb": "المعمورة الشاطىء", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48572039, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2870193", "31.2885711", "30.0266271", "30.0272941"], "display_name": "شارع 3, المعمورة الشاطىء, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2726183", "lon": "30.0149248", "name": "شارع امير المؤمنين", "type": "residential", "class": "highway", "osm_id": 746594787, "address": {"road": "شارع امير المؤمنين", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21923", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48637304, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2717134", "31.2736288", "30.0143924", "30.0154340"], "display_name": "شارع امير المؤمنين, ميامي, المندرة, الإسكندرية, 21923, مصر"}, {"lat": "31.2784125", "lon": "30.0157385", "name": "شارع مسجد الرقيب", "type": "residential", "class": "highway", "osm_id": 749213712, "address": {"road": "شارع مسجد الرقيب", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 51745807, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2779276", "31.2791699", "30.0150881", "30.0164877"], "display_name": "شارع مسجد الرقيب, ميامي, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2707545", "lon": "30.0152455", "name": "شارع محمد حسين", "type": "residential", "class": "highway", "osm_id": 746325945, "address": {"road": "شارع محمد حسين", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21923", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48636459, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2700889", "31.2714193", "30.0146182", "30.0158711"], "display_name": "شارع محمد حسين, ميامي, المندرة, الإسكندرية, 21923, مصر"}, {"lat": "31.2805286", "lon": "30.0206541", "name": "شارع خلف الجمعيه", "type": "residential", "class": "highway", "osm_id": 747258501, "address": {"road": "شارع خلف الجمعيه", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 49408074, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2800615", "31.2809994", "30.0201190", "30.0209468"], "display_name": "شارع خلف الجمعيه, ميامي, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2797518", "lon": "30.0164301", "name": "شارع 110", "type": "residential", "class": "highway", "osm_id": 747258488, "address": {"road": "شارع 110", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48916840, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2794449", "31.2800244", "30.0160318", "30.0168533"], "display_name": "شارع 110, ميامي, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2812415", "lon": "30.0128066", "name": "شارع جمال عبد الناصر", "type": "primary", "class": "highway", "osm_id": 228608454, "address": {"road": "شارع جمال عبد الناصر", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21919", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48940940, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2809568", "31.2814273", "30.0125412", "30.0131468"], "display_name": "شارع جمال عبد الناصر, ميامي, المندرة, الإسكندرية, 21919, مصر"}, {"lat": "31.2738076", "lon": "30.0177801", "name": "شارع 12", "type": "residential", "class": "highway", "osm_id": 749503485, "address": {"road": "شارع 12", "state": "الإسكندرية", "suburb": "ميامي", "country": "مصر", "village": "المندرة", "postcode": "21923", "country_code": "eg", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "way", "place_id": 48691711, "importance": 0.053409484245059854, "place_rank": 26, "addresstype": "road", "boundingbox": ["31.2735612", "31.2740793", "30.0175122", "30.0180258"], "display_name": "شارع 12, ميامي, المندرة, الإسكندرية, 21923, مصر"}]', '2026-06-01 00:03:16.484893+00', '2026-07-01 00:03:16.484+00');
INSERT INTO public.nominatim_cache VALUES ('4399ad4e-cad0-41d7-b9d8-5fdf392320bb', 'streets:ar:alexandria__al_mamurah:شارع واسع', 'ar', '[]', '2026-06-01 00:03:17.714704+00', '2026-07-01 00:03:17.713+00');
INSERT INTO public.nominatim_cache VALUES ('9aa75da7-d2e8-4d8b-9b6f-7fe5761d662c', 'reverse:ar:31.12443:29.77406', 'ar', '{"lat": "31.1244016", "lon": "29.7740449", "name": "", "type": "house", "class": "place", "osm_id": 7067050084, "address": {"road": "شارع 13", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "house_number": "38", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48886253, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1243516", "31.1244516", "29.7739949", "29.7740949"], "display_name": "38, شارع 13, العجمى, الهانوفيل, الإسكندرية, 21575, مصر"}', '2026-06-21 21:58:51.095816+00', '2026-07-21 21:58:51.093+00');
INSERT INTO public.nominatim_cache VALUES ('e24f8e49-f609-4187-aaad-4ab236384130', 'reverse:en:31.12443:29.77406', 'en', '{"lat": "31.1244016", "lon": "29.7740449", "name": "", "type": "house", "class": "place", "osm_id": 7067050084, "address": {"road": "Street 13", "state": "Alexandria", "country": "Egypt", "village": "Al Hanuvil", "postcode": "21575", "country_code": "eg", "house_number": "38", "neighbourhood": "Al Agamy", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48886253, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1243516", "31.1244516", "29.7739949", "29.7740949"], "display_name": "38, Street 13, Al Agamy, Al Hanuvil, Alexandria, 21575, Egypt"}', '2026-06-21 21:58:52.057195+00', '2026-07-21 21:58:52.056+00');
INSERT INTO public.nominatim_cache VALUES ('bb85c460-89ec-462c-b6c0-8aa5f3796a08', 'reverse:ar:31.12438:29.77411', 'ar', '{"lat": "31.1244016", "lon": "29.7740449", "name": "", "type": "house", "class": "place", "osm_id": 7067050084, "address": {"road": "شارع 13", "state": "الإسكندرية", "country": "مصر", "village": "الهانوفيل", "postcode": "21575", "country_code": "eg", "house_number": "38", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48376829, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1243516", "31.1244516", "29.7739949", "29.7740949"], "display_name": "38, شارع 13, العجمى, الهانوفيل, الإسكندرية, 21575, مصر"}', '2026-06-21 22:00:00.508829+00', '2026-07-21 22:00:00.507+00');
INSERT INTO public.nominatim_cache VALUES ('631dbe2e-19d4-4551-b934-e4374a1ca587', 'reverse:ar:31.12914:29.77716', 'ar', '{"lat": "31.1291464", "lon": "29.7771697", "name": "", "type": "house", "class": "place", "osm_id": 7067050243, "address": {"road": "شارع 10", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "21575", "country_code": "eg", "house_number": "45", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48849948, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1290964", "31.1291964", "29.7771197", "29.7772197"], "display_name": "45, شارع 10, العجمى, العجمي, الإسكندرية, 21575, مصر"}', '2026-06-22 00:26:03.281573+00', '2026-07-22 00:26:03.278+00');
INSERT INTO public.nominatim_cache VALUES ('cc95e132-1f72-4d7e-a57c-534b1dbd94a9', 'reverse:en:31.12914:29.77716', 'en', '{"lat": "31.1291464", "lon": "29.7771697", "name": "", "type": "house", "class": "place", "osm_id": 7067050243, "address": {"road": "Street 10", "state": "Alexandria", "country": "Egypt", "village": "Agami", "postcode": "21575", "country_code": "eg", "house_number": "45", "neighbourhood": "Al Agamy", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48849948, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1290964", "31.1291964", "29.7771197", "29.7772197"], "display_name": "45, Street 10, Al Agamy, Agami, Alexandria, 21575, Egypt"}', '2026-06-22 00:26:04.20012+00', '2026-07-22 00:26:04.198+00');
INSERT INTO public.nominatim_cache VALUES ('82050ddf-3e1e-4401-9bcc-21c8f7bb7db2', 'reverse:en:31.12646:29.77872', 'en', '{"lat": "31.1265402", "lon": "29.7787772", "name": "", "type": "house", "class": "place", "osm_id": 7067050320, "address": {"road": "Street 2", "state": "Alexandria", "country": "Egypt", "village": "Agami", "postcode": "21575", "country_code": "eg", "house_number": "33", "neighbourhood": "Al Agamy", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 49034007, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1264902", "31.1265902", "29.7787272", "29.7788272"], "display_name": "33, Street 2, Al Agamy, Agami, Alexandria, 21575, Egypt"}', '2026-06-22 11:46:04.873642+00', '2026-07-22 11:46:04.872+00');
INSERT INTO public.nominatim_cache VALUES ('f7a38610-d9be-4173-a7c6-aae7a85e3530', 'reverse:ar:31.12646:29.77872', 'ar', '{"lat": "31.1265402", "lon": "29.7787772", "name": "", "type": "house", "class": "place", "osm_id": 7067050320, "address": {"road": "شارع 2", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "21575", "country_code": "eg", "house_number": "33", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48824412, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1264902", "31.1265902", "29.7787272", "29.7788272"], "display_name": "33, شارع 2, العجمى, العجمي, الإسكندرية, 21575, مصر"}', '2026-06-22 11:46:05.968378+00', '2026-07-22 11:46:05.967+00');
INSERT INTO public.nominatim_cache VALUES ('cf1ba560-2ae1-424b-b95a-a589f53b00c7', 'reverse:en:31.12644:29.77868', 'en', '{"lat": "31.1263931", "lon": "29.7786266", "name": "", "type": "house", "class": "place", "osm_id": 7067050321, "address": {"road": "Street 2", "state": "Alexandria", "country": "Egypt", "village": "Agami", "postcode": "21575", "country_code": "eg", "house_number": "31", "neighbourhood": "Al Agamy", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 48845884, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1263431", "31.1264431", "29.7785766", "29.7786766"], "display_name": "31, Street 2, Al Agamy, Agami, Alexandria, 21575, Egypt"}', '2026-06-22 11:48:50.705071+00', '2026-07-22 11:48:50.704+00');
INSERT INTO public.nominatim_cache VALUES ('078ea064-d8f3-452a-b6c3-5b47b7730b7d', 'reverse:ar:31.12644:29.77868', 'ar', '{"lat": "31.1263931", "lon": "29.7786266", "name": "", "type": "house", "class": "place", "osm_id": 7067050321, "address": {"road": "شارع 2", "state": "الإسكندرية", "country": "مصر", "village": "العجمي", "postcode": "21575", "country_code": "eg", "house_number": "31", "neighbourhood": "العجمى", "ISO3166-2-lvl4": "EG-ALX"}, "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright", "osm_type": "node", "place_id": 49136038, "importance": 0.00007615091172651282, "place_rank": 30, "addresstype": "place", "boundingbox": ["31.1263431", "31.1264431", "29.7785766", "29.7786766"], "display_name": "31, شارع 2, العجمى, العجمي, الإسكندرية, 21575, مصر"}', '2026-06-22 11:48:51.840753+00', '2026-07-22 11:48:51.839+00');


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.orders VALUES ('1776912555604k4mst', 'ORD-000001', 'pending', '{"id": "1776912555604k4mst", "area": "al montaza district", "floor": "30", "photos": [], "status": "pending", "street": "الإسكندرية، حي المنتزه، العصافرة، المعهد الديني ", "building": "30", "category": "electricity", "clientId": "e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac", "landmark": "", "apartment": "30", "createdAt": "2026-04-23T02:49:15.604Z", "visitDate": "23/4/2026", "visitTime": "10:00", "clientName": "حمص ابو حلاوة", "deviceType": "وصله دش", "governorate": "alexandria", "orderNumber": "ORD-2026-9080", "subCategory": "توصيلات كهربائية", "clientMobile": "01098765432", "problemDescription": "الحقونى"}', '2026-04-23 02:49:15.638448+00', NULL, 1, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', NULL, 'electricity', 'alexandria', 'al montaza district', '2026-04-23 02:49:15.676+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('1776948470028vhxyz', 'ORD-000002', 'pending', '{"id": "1776948470028vhxyz", "area": "al montaza district", "floor": "30", "photos": [], "status": "pending", "street": "الإسكندرية، حي المنتزه، العصافرة، المعهد الديني ", "building": "30", "category": "electricity", "clientId": "706dc1d9-d694-4e8c-99f6-ec64485af6e9", "landmark": "", "apartment": "30", "createdAt": "2026-04-23T12:47:50.029Z", "visitDate": "23/4/2026", "visitTime": "10:00", "clientName": "ابو حمص وحلاوة", "deviceType": "مشترك كهربائي", "governorate": "alexandria", "orderNumber": "ORD-2026-5791", "subCategory": "توصيلات كهربائية", "clientMobile": "01298765432", "problemDescription": "مشترك فرقع"}', '2026-04-23 12:47:49.850217+00', NULL, 2, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', NULL, 'electricity', 'alexandria', 'al montaza district', '2026-04-23 12:47:49.885+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('1777470653087dtcbt', 'ORD-000005', 'pending', '{"id": "1777470653087dtcbt", "area": "camp shizar", "floor": "2", "photos": [], "status": "pending", "street": "الإسكندرية، كامب شيزار، شارع بورسعيد", "building": "2", "category": "carpentry", "clientId": "3e00499d-f630-42af-a987-31604623ad77", "landmark": "", "apartment": "2", "createdAt": "2026-04-29T13:50:53.087Z", "visitDate": "29/4/2026", "visitTime": "06:00", "clientName": "User1", "deviceType": "باب شقه", "governorate": "alexandria", "orderNumber": "ORD-2026-8199", "subCategory": "أبواب", "subImageKey": "sub_doors", "clientMobile": "01174185296", "problemDescription": "طبله باب شقة مفتاحها ضايع وعاوزين ندخلها"}', '2026-04-29 13:50:52.846235+00', NULL, 5, '3e00499d-f630-42af-a987-31604623ad77', NULL, 'carpentry', 'alexandria', 'alexandria__camp_shizar', '2026-04-29 13:50:53.042+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('1776979267932wz9st', 'ORD-000003', 'pending', '{"id": "1776979267932wz9st", "area": "al montaza district", "floor": "30", "photos": [], "status": "pending", "street": "الإسكندرية، حي المنتزه، المنتزه، عبدجمال عبد الناصر", "building": "30", "category": "ac", "clientId": "706dc1d9-d694-4e8c-99f6-ec64485af6e9", "landmark": "", "latitude": 31.2001, "apartment": "30", "createdAt": "2026-04-23T21:21:07.932Z", "longitude": 29.9187, "visitDate": "23/4/2026", "visitTime": "11:00", "clientName": "ابو حمص وحلاوة", "deviceType": "تكييف", "governorate": "alexandria", "orderNumber": "ORD-2026-7245", "subCategory": "صيانة مكيفات", "clientMobile": "01298765432", "problemDescription": "الريموت ضاع "}', '2026-04-23 21:21:07.998743+00', NULL, 3, '706dc1d9-d694-4e8c-99f6-ec64485af6e9', NULL, 'ac', 'alexandria', 'al montaza district', '2026-04-23 21:21:08.013+00', NULL, NULL, '0101000020E6100000D0D556EC2FEB3D40FAEDEBC039333F40', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('1777193922290e4bhi', 'ORD-000004', 'acknowledged', '{"id": "1777193922290e4bhi", "area": "agamy", "floor": "20", "photos": [], "status": "acknowledged", "street": "الإسكندرية، العجمي، شارع مساكن الحديد و الصلب, مساكن الحديد و الصلب, الإسكندرية, 21575, مصر", "building": "20", "category": "plumbing", "clientId": "379dc225-6cbd-4672-ae50-fc676ffc522b", "landmark": "", "latitude": 31.1133946, "apartment": "20", "createdAt": "2026-04-26T08:58:42.291Z", "longitude": 29.7812944, "visitDate": "26/4/2026", "visitTime": "2:00", "clientName": "هيثم فخرى", "deviceType": "مشاية", "governorate": "alexandria", "orderNumber": "ORD-2026-1467", "subCategory": "أدوات صحية", "subImageKey": "sub_sanitary", "clientMobile": "01551234567", "technicianId": "d72a32d0-d012-4179-bfaa-65cc334eea4f", "technicianName": "احمد عبد العظيم", "technicianMobile": "01112345678", "technicianRating": 4.8, "problemDescription": "اى كلام"}', '2026-04-26 08:58:42.77028+00', '2026-04-26 08:59:18.645+00', 4, '379dc225-6cbd-4672-ae50-fc676ffc522b', 'd72a32d0-d012-4179-bfaa-65cc334eea4f', 'plumbing', 'alexandria', 'alexandria__agamy', '2026-04-26 08:59:18.645+00', NULL, NULL, '0101000020E6100000468CE8E802C83D40028BB26D071D3F40', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('1777470980729qvaqb', 'ORD-000006', 'pending', '{"id": "1777470980729qvaqb", "area": "camp shizar", "floor": "30", "photos": [], "status": "pending", "street": "الإسكندرية، كامب شيزار، شارع بورسعيد", "building": "169", "category": "carpentry", "clientId": "3e00499d-f630-42af-a987-31604623ad77", "landmark": "", "apartment": "30", "createdAt": "2026-04-29T13:56:20.729Z", "visitDate": "29/4/2026", "visitTime": "05:15", "clientName": "User1", "deviceType": "باب", "governorate": "alexandria", "orderNumber": "ORD-2026-4895", "subCategory": "أبواب", "subImageKey": "sub_doors", "clientMobile": "01174185296", "problemDescription": "الحق تعالى "}', '2026-04-29 13:56:20.722121+00', NULL, 6, '3e00499d-f630-42af-a987-31604623ad77', NULL, 'carpentry', 'alexandria', 'alexandria__camp_shizar', '2026-04-29 13:56:20.763+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('177747114883757wxw', 'ORD-000007', 'pending', '{"id": "177747114883757wxw", "area": "al ibrahimeyah", "floor": "10", "photos": [], "status": "pending", "street": "الإسكندرية، الابراهيمية، ابو قير", "building": "10", "category": "carpentry", "clientId": "3e00499d-f630-42af-a987-31604623ad77", "landmark": "", "apartment": "166", "createdAt": "2026-04-29T13:59:08.837Z", "visitDate": "30/6/2026", "visitTime": "06:00", "clientName": "User1", "deviceType": "باب", "governorate": "alexandria", "orderNumber": "ORD-2026-2509", "subCategory": "أبواب", "subImageKey": "sub_doors", "clientMobile": "01174185296", "problemDescription": "يارب تيجي"}', '2026-04-29 13:59:08.939732+00', NULL, 7, '3e00499d-f630-42af-a987-31604623ad77', NULL, 'carpentry', 'alexandria', 'alexandria__al_ibrahimeyah', '2026-04-29 13:59:08.984+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES ('1780272244622cqlcx', 'ORD-000008', 'pending', '{"id": "1780272244622cqlcx", "area": "al mamurah", "floor": "10", "photos": [], "status": "pending", "street": "الإسكندرية، المعمورة، شارع واسع", "building": "10", "category": "ac", "clientId": "e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac", "landmark": "", "apartment": "10", "createdAt": "2026-06-01T00:04:04.623Z", "visitDate": "95/10/2026", "visitTime": "12:00", "clientName": "حمص ابو حلاوة", "deviceType": "كبير", "governorate": "alexandria", "orderNumber": "ORD-2026-7828", "subCategory": "صيانة مكيفات", "subImageKey": "sub_ac_repair", "clientMobile": "01098765432", "problemDescription": "بيطلع مايه "}', '2026-06-01 00:04:04.650278+00', NULL, 8, 'e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', NULL, 'ac', 'alexandria', 'alexandria__al_mamurah', '2026-06-01 00:04:04.664+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: phone_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.phone_verifications VALUES ('ee3cb2f9-60a9-4c59-bcd7-d44e01f87c18', '01012345678', '84a7a3a8cb56716ff7951940bc4b3b1879d145fad06d06f96a1556895b97feac', '2026-04-23 13:20:06.739+00', '2026-04-23 13:10:16.715+00', '2026-04-23 13:10:06.741576+00');
INSERT INTO public.phone_verifications VALUES ('22f661a2-f509-4845-a3c5-69948be503db', '01099887766', '1af59f5625e4e8ace1e38f9c973f6cb5da6d1b1c4f47f69b00f44329115602f4', '2026-04-23 13:20:29.538+00', '2026-04-23 13:10:43.696+00', '2026-04-23 13:10:29.539171+00');
INSERT INTO public.phone_verifications VALUES ('85eb0f4a-2af9-47fa-9179-7f81a30a678c', '01011223344', '5f5484e924815dc6cf24c2ef98ff31ccd3bfea405e5f2874f149f8b73a36b07b', '2026-04-23 13:26:42.051+00', '2026-04-23 13:17:01.339+00', '2026-04-23 13:16:42.052296+00');
INSERT INTO public.phone_verifications VALUES ('6e569095-7810-4bcf-a206-10adf256ffd1', '01022334455', 'dcd91c6dc343838d49d7cd08dc012294fd7782828c93b0bc9c4d4991cede0dfc', '2026-04-23 13:32:29.187+00', '2026-04-23 13:22:42.903+00', '2026-04-23 13:22:29.19893+00');
INSERT INTO public.phone_verifications VALUES ('7515df94-b047-4806-9784-4a4757d43902', '01055667788', '6e53a9d7ebe877ad4e7d1dfc5364fcdc30c54920098a9d561597be7a7a20b947', '2026-04-23 13:36:16.9+00', NULL, '2026-04-23 13:26:16.901636+00');
INSERT INTO public.phone_verifications VALUES ('b5f6ab93-9892-4e01-895c-a9d0c3f98166', '01512312312', '67ba11aaff004a799f7ff34b64d27473fdccc905226e4b7e137e4b9d39f33c9b', '2026-04-24 11:44:51.628+00', NULL, '2026-04-24 11:34:51.628689+00');
INSERT INTO public.phone_verifications VALUES ('54d7d8f6-238a-464d-9341-2120c5180dab', '01025815736', 'b388df14d66556a6c58263a5ded977d508cf158854af5d09f8990af74c165087', '2026-04-24 11:45:53.907+00', NULL, '2026-04-24 11:35:53.907972+00');
INSERT INTO public.phone_verifications VALUES ('630042b6-48af-496f-a3b5-bbb1f53fd14c', '01551234567', '1546057a576e213c1c8caabd9e154a7a0b3acd9b48ff8dd65a87648387e91999', '2026-04-26 09:00:18.095+00', NULL, '2026-04-26 08:50:18.096326+00');
INSERT INTO public.phone_verifications VALUES ('89b1d92f-33d0-4412-af5a-bf6655051812', '01112345678', 'c260e3f40bf3335079c89ac76be3a603a10b8c9912a442acc2bb9bde1e609848', '2026-04-26 09:04:28.295+00', NULL, '2026-04-26 08:54:28.296684+00');
INSERT INTO public.phone_verifications VALUES ('17739339-e25d-4d04-87cc-2df3cb5d44a0', '01112345678', '2f8235d8acea9b9eb7179b038fac7b47cd78ceff16139a72a15d79ccf79d94a4', '2026-04-26 09:05:43.035+00', NULL, '2026-04-26 08:55:43.036265+00');
INSERT INTO public.phone_verifications VALUES ('1116e432-5983-47df-a3c2-b6a1dbae6d75', '01215935786', '88eae6920125b01d464e41f7f67d4059fd39063ec7ee3883607efa6a35c2be51', '2026-04-29 13:15:18.609+00', NULL, '2026-04-29 13:05:18.610016+00');
INSERT INTO public.phone_verifications VALUES ('a7dcd481-ea02-4bf7-b286-70013e2a9463', '01174185296', '209904286058969997dfc341185ed3e83fec92dd1babda8f7795daad645a013b', '2026-04-29 13:23:33.419+00', NULL, '2026-04-29 13:13:33.419429+00');
INSERT INTO public.phone_verifications VALUES ('50e4b74a-d78c-4b7f-8fe9-0ba4841d4a87', '01174185296', '82032d53d671a0dfe7973824bedfccbe66a34e2d2f91d7f4f2dfe5fdcde1718c', '2026-04-29 13:24:07.163+00', NULL, '2026-04-29 13:14:07.164226+00');
INSERT INTO public.phone_verifications VALUES ('27ca3ff9-e0e1-4264-b960-640d04157eb6', '01174185296', 'a7e64be3af48412b221907c899e453e9bd5558dabdbe039a6f7217a7794a2c37', '2026-04-29 13:24:16.554+00', NULL, '2026-04-29 13:14:16.554347+00');
INSERT INTO public.phone_verifications VALUES ('2b7b4154-f47f-47a2-b2f2-1f978d07a83b', '01598765432', '54d698caa692d0a69bb6e18e303152a0ca98d290d534fc306fa631a4075c60b2', '2026-06-21 22:04:50.237+00', NULL, '2026-06-21 21:54:50.23977+00');
INSERT INTO public.phone_verifications VALUES ('3a66f3b2-46ec-4438-b4a2-63e1d107954c', '01598765432', 'acf87f187adc37529b00ed9e5fe01eb1e29637631f31082628126331a25095f9', '2026-06-21 22:07:11.785+00', NULL, '2026-06-21 21:57:11.786393+00');
INSERT INTO public.phone_verifications VALUES ('6d5fc1fe-1dfd-4635-b8ce-77e57000b056', '01598765432', '2a5c82b3708210d26f163781743005cf39fd1272ca660dbb8a9cc401b8ba6cb4', '2026-06-21 22:07:25.792+00', NULL, '2026-06-21 21:57:25.793346+00');
INSERT INTO public.phone_verifications VALUES ('2a99317f-7a07-4064-b78e-c10215dd0f7b', '01598765432', '1f7c784ea0c7480017d2bb83ad661926b159657de69bd8038781f1749bc56f1e', '2026-06-22 00:34:41.785+00', NULL, '2026-06-22 00:24:41.787145+00');
INSERT INTO public.phone_verifications VALUES ('a127a266-a67a-4c95-9f4f-b2c191af5f4a', '01212345678', '949a7e47dda619ba0c9a50fd2637a4af8c6d463aac545a15b862a674b0b900d6', '2026-06-22 11:55:04.495+00', NULL, '2026-06-22 11:45:04.496992+00');


--
-- Data for Name: rate_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rate_limits VALUES (94, 'login:ip:169.150.196.119, 10.81.0.228, 10.48.3.35, 127.0.0.1', '2026-06-23 08:53:59.111033+00');
INSERT INTO public.rate_limits VALUES (95, 'login:id:admin', '2026-06-23 08:53:59.875495+00');


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.schema_migrations VALUES ('001_location_aliases.sql', '2026-06-18 23:03:51.200911+00');
INSERT INTO public.schema_migrations VALUES ('002_startup_migrations.sql', '2026-06-18 23:03:51.200911+00');
INSERT INTO public.schema_migrations VALUES ('003_add_location_centroid.sql', '2026-06-18 23:03:51.200911+00');
INSERT INTO public.schema_migrations VALUES ('004_add_address_columns.sql', '2026-06-18 23:03:51.200911+00');
INSERT INTO public.schema_migrations VALUES ('005_phase1_tech_fields.sql', '2026-06-18 23:03:51.200911+00');
INSERT INTO public.schema_migrations VALUES ('006_fix_column_drift.sql', '2026-06-21 22:08:45.417768+00');


--
-- Data for Name: service_domains; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.service_domains VALUES ('00d00019-6e65-48f7-be66-4a86e232f7b5', 'Electricity', 'كهرباء', 'zap', true, '2026-04-25 19:57:30.486872+00', '2026-04-25 19:57:30.486872+00', 0);
INSERT INTO public.service_domains VALUES ('e25069fa-dc48-41a4-b825-14fcbb4d1e96', 'Plumbing', 'سباكة', 'droplet', true, '2026-04-25 19:57:30.501481+00', '2026-04-25 19:57:30.501481+00', 0);
INSERT INTO public.service_domains VALUES ('29acdc5e-6c9a-4495-b0c9-23d7cfc9d901', 'Air Conditioning', 'تكييف', 'wind', true, '2026-04-25 19:57:30.515935+00', '2026-04-25 19:57:30.515935+00', 0);
INSERT INTO public.service_domains VALUES ('e0d37eea-98ad-4135-859f-bdd7b04f767b', 'Carpentry', 'نجارة', 'tool', true, '2026-04-25 19:57:30.528417+00', '2026-04-25 19:57:30.528417+00', 0);
INSERT INTO public.service_domains VALUES ('6e76ea7b-784a-47f3-9dfe-45f92c821c3f', 'Appliances', 'أجهزة منزلية', 'monitor', true, '2026-04-25 19:57:30.538463+00', '2026-04-25 19:57:30.538463+00', 0);
INSERT INTO public.service_domains VALUES ('99803acf-1bdd-488c-a26a-bd057b1320f9', 'Painting', 'دهانات', 'pen-tool', true, '2026-04-25 19:57:30.553878+00', '2026-04-25 19:57:30.553878+00', 0);
INSERT INTO public.service_domains VALUES ('2b34be2a-da3d-4d52-a095-95544816eb96', 'Pest Control', 'مكافحة حشرات', 'shield', true, '2026-04-25 19:57:30.565778+00', '2026-04-25 19:57:30.565778+00', 0);
INSERT INTO public.service_domains VALUES ('4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc', 'Flooring', 'أرضيات', 'grid', true, '2026-04-25 19:57:30.58153+00', '2026-04-25 19:57:30.58153+00', 0);
INSERT INTO public.service_domains VALUES ('f9592c1e-783d-4be1-b837-5cee8abbe56a', 'Computer', 'كمبيوتر', 'monitor', true, '2026-06-22 12:00:15.735862+00', '2026-06-22 12:00:15.735862+00', 0);


--
-- Data for Name: service_specializations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.service_specializations VALUES ('0f419bd0-6b7e-4a66-8863-70805a277242', '00d00019-6e65-48f7-be66-4a86e232f7b5', 'Wiring & Circuits', 'أسلاك ودوائر كهربائية', true, '2026-04-25 19:57:30.489396+00', '2026-04-25 19:57:30.489396+00', 0);
INSERT INTO public.service_specializations VALUES ('72477468-758e-4303-ad5e-f4ed921e999c', '00d00019-6e65-48f7-be66-4a86e232f7b5', 'Sockets & Switches', 'مقابس ومفاتيح', true, '2026-04-25 19:57:30.491965+00', '2026-04-25 19:57:30.491965+00', 0);
INSERT INTO public.service_specializations VALUES ('96897e92-c5bf-4982-805e-e26f03d82887', '00d00019-6e65-48f7-be66-4a86e232f7b5', 'Lighting', 'إضاءة', true, '2026-04-25 19:57:30.49564+00', '2026-04-25 19:57:30.49564+00', 0);
INSERT INTO public.service_specializations VALUES ('4f43696d-1ca2-4007-8940-b114c4914454', '00d00019-6e65-48f7-be66-4a86e232f7b5', 'Electrical Panel', 'لوحة كهربائية', true, '2026-04-25 19:57:30.498869+00', '2026-04-25 19:57:30.498869+00', 0);
INSERT INTO public.service_specializations VALUES ('8cdbec40-42eb-41cc-9430-36bc89e1ff50', 'e25069fa-dc48-41a4-b825-14fcbb4d1e96', 'Pipes & Leaks', 'مواسير وتسربات', true, '2026-04-25 19:57:30.503929+00', '2026-04-25 19:57:30.503929+00', 0);
INSERT INTO public.service_specializations VALUES ('cfba4bd5-5acf-4ffd-bc86-b10c737465a4', 'e25069fa-dc48-41a4-b825-14fcbb4d1e96', 'Water Heaters', 'سخانات', true, '2026-04-25 19:57:30.507235+00', '2026-04-25 19:57:30.507235+00', 0);
INSERT INTO public.service_specializations VALUES ('9ba0aa7c-525f-4eb8-9702-4ed0faac9eee', 'e25069fa-dc48-41a4-b825-14fcbb4d1e96', 'Toilets & Sanitary', 'حمامات وصحي', true, '2026-04-25 19:57:30.510242+00', '2026-04-25 19:57:30.510242+00', 0);
INSERT INTO public.service_specializations VALUES ('7c5e0b85-480f-4c3c-abbf-3b359c993806', 'e25069fa-dc48-41a4-b825-14fcbb4d1e96', 'Water Pumps', 'طلمبات مياه', true, '2026-04-25 19:57:30.512604+00', '2026-04-25 19:57:30.512604+00', 0);
INSERT INTO public.service_specializations VALUES ('f0298ee0-6b15-4e8c-b284-bcbdc65e2a04', '29acdc5e-6c9a-4495-b0c9-23d7cfc9d901', 'Installation', 'تركيب', true, '2026-04-25 19:57:30.518956+00', '2026-04-25 19:57:30.518956+00', 0);
INSERT INTO public.service_specializations VALUES ('4c98f278-8235-47cd-8062-ee86a174e143', '29acdc5e-6c9a-4495-b0c9-23d7cfc9d901', 'Maintenance', 'صيانة', true, '2026-04-25 19:57:30.521792+00', '2026-04-25 19:57:30.521792+00', 0);
INSERT INTO public.service_specializations VALUES ('4e71a846-07ab-41e5-b24b-520afcb7675f', '29acdc5e-6c9a-4495-b0c9-23d7cfc9d901', 'Gas Recharge', 'شحن غاز', true, '2026-04-25 19:57:30.524042+00', '2026-04-25 19:57:30.524042+00', 0);
INSERT INTO public.service_specializations VALUES ('3075724e-b164-489b-b667-803ab21b93e7', '29acdc5e-6c9a-4495-b0c9-23d7cfc9d901', 'Cleaning', 'تنظيف', true, '2026-04-25 19:57:30.525888+00', '2026-04-25 19:57:30.525888+00', 0);
INSERT INTO public.service_specializations VALUES ('98d608da-ac28-458d-bdee-18273a33db7b', 'e0d37eea-98ad-4135-859f-bdd7b04f767b', 'Doors & Windows', 'أبواب ونوافذ', true, '2026-04-25 19:57:30.530923+00', '2026-04-25 19:57:30.530923+00', 0);
INSERT INTO public.service_specializations VALUES ('901a13b0-d5fa-4650-be0b-2dfc1e946ee5', 'e0d37eea-98ad-4135-859f-bdd7b04f767b', 'Furniture Assembly', 'تجميع أثاث', true, '2026-04-25 19:57:30.532875+00', '2026-04-25 19:57:30.532875+00', 0);
INSERT INTO public.service_specializations VALUES ('bab6674b-de59-45d5-9b95-068837eeb150', 'e0d37eea-98ad-4135-859f-bdd7b04f767b', 'Cabinets & Wardrobes', 'خزائن ودواليب', true, '2026-04-25 19:57:30.534832+00', '2026-04-25 19:57:30.534832+00', 0);
INSERT INTO public.service_specializations VALUES ('f13bc408-870f-4ba5-9442-470ec1be2858', '6e76ea7b-784a-47f3-9dfe-45f92c821c3f', 'Washing Machines', 'غسالات', true, '2026-04-25 19:57:30.541255+00', '2026-04-25 19:57:30.541255+00', 0);
INSERT INTO public.service_specializations VALUES ('024f1411-3022-4a03-adc4-c57753df9953', '6e76ea7b-784a-47f3-9dfe-45f92c821c3f', 'Refrigerators', 'ثلاجات', true, '2026-04-25 19:57:30.543763+00', '2026-04-25 19:57:30.543763+00', 0);
INSERT INTO public.service_specializations VALUES ('761760ec-c802-4902-bc7a-59cee03105e9', '6e76ea7b-784a-47f3-9dfe-45f92c821c3f', 'Ovens & Cookers', 'أفران وطباخات', true, '2026-04-25 19:57:30.547172+00', '2026-04-25 19:57:30.547172+00', 0);
INSERT INTO public.service_specializations VALUES ('00f2a863-f471-4214-a653-f49ef252083d', '6e76ea7b-784a-47f3-9dfe-45f92c821c3f', 'Dishwashers', 'غسالات أطباق', true, '2026-04-25 19:57:30.550546+00', '2026-04-25 19:57:30.550546+00', 0);
INSERT INTO public.service_specializations VALUES ('18f5b8df-f5d0-4587-aaeb-2c930d06f364', '99803acf-1bdd-488c-a26a-bd057b1320f9', 'Interior Walls', 'جدران داخلية', true, '2026-04-25 19:57:30.557007+00', '2026-04-25 19:57:30.557007+00', 0);
INSERT INTO public.service_specializations VALUES ('216333bf-efa9-40ae-8afe-456c21130ce2', '99803acf-1bdd-488c-a26a-bd057b1320f9', 'Exterior Walls', 'جدران خارجية', true, '2026-04-25 19:57:30.559704+00', '2026-04-25 19:57:30.559704+00', 0);
INSERT INTO public.service_specializations VALUES ('f180fb6c-4116-49a5-b1bf-64c05d747f21', '99803acf-1bdd-488c-a26a-bd057b1320f9', 'Waterproofing', 'عزل مائي', true, '2026-04-25 19:57:30.563222+00', '2026-04-25 19:57:30.563222+00', 0);
INSERT INTO public.service_specializations VALUES ('c6a936c4-7a73-40e8-abd0-572e6ca73124', '2b34be2a-da3d-4d52-a095-95544816eb96', 'Cockroaches', 'صراصير', true, '2026-04-25 19:57:30.568453+00', '2026-04-25 19:57:30.568453+00', 0);
INSERT INTO public.service_specializations VALUES ('f637b9a8-092e-4b2b-83d9-07993d137806', '2b34be2a-da3d-4d52-a095-95544816eb96', 'Rodents', 'قوارض', true, '2026-04-25 19:57:30.571904+00', '2026-04-25 19:57:30.571904+00', 0);
INSERT INTO public.service_specializations VALUES ('add700b8-cb0b-4587-920f-996460376772', '2b34be2a-da3d-4d52-a095-95544816eb96', 'Bedbugs', 'بق الفراش', true, '2026-04-25 19:57:30.575027+00', '2026-04-25 19:57:30.575027+00', 0);
INSERT INTO public.service_specializations VALUES ('5b9beb9c-1883-404a-adf7-5e94777f0249', '2b34be2a-da3d-4d52-a095-95544816eb96', 'General Fumigation', 'تدخين عام', true, '2026-04-25 19:57:30.577663+00', '2026-04-25 19:57:30.577663+00', 0);
INSERT INTO public.service_specializations VALUES ('a97da495-8664-46b1-acad-3945834a15ce', '4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc', 'Tiles', 'بلاط', true, '2026-04-25 19:57:30.584255+00', '2026-04-25 19:57:30.584255+00', 0);
INSERT INTO public.service_specializations VALUES ('ee3129a7-5cb8-4aa9-9bdd-56423b61d6cf', '4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc', 'Marble', 'رخام', true, '2026-04-25 19:57:30.587142+00', '2026-04-25 19:57:30.587142+00', 0);
INSERT INTO public.service_specializations VALUES ('78829612-490d-4229-90bf-0c336ed56d77', '4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc', 'Parquet', 'باركيه', true, '2026-04-25 19:57:30.590534+00', '2026-04-25 19:57:30.590534+00', 0);
INSERT INTO public.service_specializations VALUES ('621be1d2-eccb-408e-ba19-7d479a782e1c', '4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc', 'Epoxy', 'إيبوكسي', true, '2026-04-25 19:57:30.593397+00', '2026-04-25 19:57:30.593397+00', 0);


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.sessions VALUES ('d0f9a07e943a070742c9e0d0ead362db0f71bd23ed6d0527fb54cd0ed5aed49a', '{"user": {"id": "676116fe-c50b-4254-9e82-668a15255d38", "area": null, "role": "client", "email": null, "mobile": "01234567890", "district": null, "lastName": "User", "firstName": "Test", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-29 21:47:04.649');
INSERT INTO public.sessions VALUES ('36892fe034f2fff7f26450a5ec36f409fd6a73cb1a8ce7d4faf3ba234a8f5a67', '{"user": {"id": "14553889-4839-414b-8866-38628d10ab06", "area": null, "role": "client", "email": "ali@test.com", "mobile": "01012345678", "district": null, "lastName": "حسن محمد", "firstName": "علي", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-29 21:51:53.648');
INSERT INTO public.sessions VALUES ('baf72f6e1528b46ad92d91089c93cc464dc3e61c57116d602e2a0e1919223310', '{"user": {"id": "7707e783-b957-4247-9905-c7992157a278", "area": null, "role": "client", "email": "ali@test.com", "mobile": "01012345678", "district": null, "lastName": "حسن محمد", "firstName": "علي", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-29 21:51:59.044');
INSERT INTO public.sessions VALUES ('53ea62829c5face5539e20e6cd28e88a2a4474db6852885c511ee439ca819029', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-30 00:39:46.789');
INSERT INTO public.sessions VALUES ('afc6cfac3430d28375ec694d408d97598bf20cf8659e4777a44ebc72e7e35112', '{"user": {"id": "e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac", "area": "alex_montaza", "role": "client", "email": "hammo.beka@gmail.com", "mobile": "01098765432", "district": null, "lastName": "ابو حلاوة", "firstName": "حمص", "specialty": null, "profession": null, "governorate": "alexandria", "profileImageUrl": null}, "access_token": ""}', '2026-04-30 02:46:39.489');
INSERT INTO public.sessions VALUES ('bf23ed9ee6e462284adcb92ad9f3dc97a90fd0709b5c4853aba037eafae7f961', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alex_montaza", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "district": null, "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": null, "profession": null, "governorate": "alexandria", "profileImageUrl": null}, "access_token": ""}', '2026-04-30 02:50:13.209');
INSERT INTO public.sessions VALUES ('9fec765b9ec652845508daf2c91e7aef420fbc428a512ac89588cf6f52aaecdc', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-30 12:33:20.702');
INSERT INTO public.sessions VALUES ('e10b27af825c513c769f7671cd443f559042bf68c87f28e272564ecfc1c6f272', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-30 12:33:31.596');
INSERT INTO public.sessions VALUES ('09d900bc466d2e30ad976078edfc041209aae3c4e9b6c0b86d28f1e571f9fd41', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-30 12:33:45.76');
INSERT INTO public.sessions VALUES ('89c33379f11dc5a8480094238018cbe4f81ee3b2bce96cc6c6b9c9515161f99f', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": "Fanni", "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "access_token": ""}', '2026-04-30 12:34:50.837');
INSERT INTO public.sessions VALUES ('1477ae8cf3d64fbf204b9fd6cffd55f582bb920d485d2989bc66bda776795df1', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 12:39:59.428');
INSERT INTO public.sessions VALUES ('536e1dff7d148f73a40831d254822097d8a650536a85b591b21369e660d98131', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 12:39:59.663');
INSERT INTO public.sessions VALUES ('861fbc495b59d31b1dd1e4b5711587d0fb399f10eae8f483338ff27cb3f6c5ee', '{"user": {"id": "f17eecb4-9316-495d-9dc0-fa3efda9d54d", "area": null, "role": "client", "email": null, "mobile": "01012345678", "district": null, "lastName": "User", "firstName": "Test", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 12:40:14.48');
INSERT INTO public.sessions VALUES ('cc99622dc72951badc7aa5ccf97975a96cfa4797d8c9381e87e212e6055f6ffb', '{"user": {"id": "f17eecb4-9316-495d-9dc0-fa3efda9d54d", "area": null, "role": "client", "email": null, "mobile": "01012345678", "district": null, "lastName": "User", "firstName": "Test", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 12:40:14.966');
INSERT INTO public.sessions VALUES ('622431bfe0a3a4248848d4683d204d6cc69864033c37554939f2ed71448e2a6c', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 12:43:28.376');
INSERT INTO public.sessions VALUES ('66c63db435654ff75cf4cb9209f8c4f2c753c45b88b16ae5d4ab97dda3b24f56', '{"user": {"id": "f17eecb4-9316-495d-9dc0-fa3efda9d54d", "area": null, "role": "client", "email": null, "mobile": "01012345678", "district": null, "lastName": "User", "firstName": "Test", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 12:43:28.966');
INSERT INTO public.sessions VALUES ('9d396b165f39ae38f395f7b4564463c432cae76c430450b2707c0110979523d1', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 12:46:11.397');
INSERT INTO public.sessions VALUES ('3d86a9ed0fd6ce7a354ab64fc80ec1c4c2a108ffe9ed82cbff72894062042042', '{"user": {"id": "f17eecb4-9316-495d-9dc0-fa3efda9d54d", "area": null, "role": "client", "email": null, "mobile": "01012345678", "district": null, "lastName": "User", "firstName": "Test", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 12:46:11.792');
INSERT INTO public.sessions VALUES ('ace93de4544a9edea0de86472f6998f8b6b54f7f6cfa75e7463a3d40d85b598a', '{"user": {"id": "706dc1d9-d694-4e8c-99f6-ec64485af6e9", "area": "alex_montaza", "role": "client", "email": "hammo.beka2@gmail.com", "mobile": "01298765432", "district": null, "lastName": "حمص وحلاوة", "firstName": "ابو", "specialty": null, "profession": null, "governorate": "alexandria", "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 12:52:05.766');
INSERT INTO public.sessions VALUES ('f2e21470c9ab8a04f983e4f0aff60823db13c43f595ba4ac0d7ce9a49b37db40', '{"user": {"id": "b0b499c5-3337-4bf7-8f79-6a991436dca7", "area": null, "role": "client", "email": null, "mobile": "01099887766", "district": null, "lastName": "Test User", "firstName": "OTP", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 13:10:43.88');
INSERT INTO public.sessions VALUES ('1fac7d92ba7a48ece3a9539b6aa5d7a0bf7b8f3ffcf2f3a9c06a19840b7404bc', '{"user": {"id": "98edcb00-3f5d-41ae-a6c2-3ea5247108b8", "area": null, "role": "client", "email": null, "mobile": "01033445566", "district": null, "lastName": "Skip User", "firstName": "Dev", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 13:17:01.247');
INSERT INTO public.sessions VALUES ('6a51fcd31f209788ba2522c2079a59c2158f31be4c12b70f66796d55e48e141d', '{"user": {"id": "ffe4a7f2-0228-40d1-ba45-3cf0a497b034", "area": null, "role": "client", "email": null, "mobile": "01011223344", "district": null, "lastName": "Full User", "firstName": "OTP", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 13:17:01.52');
INSERT INTO public.sessions VALUES ('7878b096ac3d9281a331b58fc72536684a0f9d942d409fa2eab22403b6444d19', '{"user": {"id": "fe4d83fc-d3c2-40c1-9854-247bd3e7ddcb", "area": null, "role": "client", "email": null, "mobile": "01022334455", "district": null, "lastName": "Test User", "firstName": "JWT", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "user", "access_token": ""}', '2026-04-30 13:22:43.137');
INSERT INTO public.sessions VALUES ('9e94b3353059c1bf39b6aeaf46b7d57e1ff0f55061b28d13a40d7ba25d603a74', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 14:46:13.266');
INSERT INTO public.sessions VALUES ('2348c41e326f43973643b643199c6199ea8f3fc301926f50d5f31a17ad315c0c', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 14:47:02.217');
INSERT INTO public.sessions VALUES ('fcab572a5e1eaeb4ebdf714c15a4aba66e4c057a30b8739454a2a310e45f6a0d', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 14:52:30.071');
INSERT INTO public.sessions VALUES ('f1240aaceca93274306b1a1f6d7ee8974c7e557e4ba60f4f195ad1d96a098dea', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 14:52:38.579');
INSERT INTO public.sessions VALUES ('e52c95044bfe40d3b5015904f79f1e6d3d195d19a8c23a10842c1901aabaa03d', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 14:53:25.487');
INSERT INTO public.sessions VALUES ('adc0ee25f082c0a8564f5b02e0dfdf2e8de63be420d12af6cc76f4b85e61ccab', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 14:53:39.134');
INSERT INTO public.sessions VALUES ('d5982411afe21f2bab25c1ecc782f4c882cd84dbfacb6fb77c9fe15066d9ae5d', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alex_montaza", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "district": null, "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": null, "profession": null, "governorate": "alexandria", "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-04-30 21:16:41.509');
INSERT INTO public.sessions VALUES ('37177680bc6a8a31a7316070089d8ee415593091cc20d5fba3e6e3208fdb2f30', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 21:42:12.97');
INSERT INTO public.sessions VALUES ('6e9096f5b68028e0a7b72e1d98c31c08223b497f6c414529cd60aae10bae4494', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null}, "source": "admin", "access_token": ""}', '2026-04-30 21:42:17.487');
INSERT INTO public.sessions VALUES ('7e6b10766d2c9f64a21d46ee21da162dfeb447f453f6e7dc9b30d7a58bd2650c', '{"user": {"id": "706dc1d9-d694-4e8c-99f6-ec64485af6e9", "area": "alex_montaza", "role": "client", "email": "hammo.beka2@gmail.com", "mobile": "01298765432", "district": null, "lastName": "حمص وحلاوة", "firstName": "ابو", "specialty": null, "profession": null, "governorate": "alexandria", "isAvailable": true, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-04-30 23:10:38.224');
INSERT INTO public.sessions VALUES ('eaefd30ba8a1450e7230d2ab5bd2b6833e25cff866a390b0c23a1eff110daee8', '{"user": {"id": "706dc1d9-d694-4e8c-99f6-ec64485af6e9", "area": "alex_montaza", "role": "client", "email": "hammo.beka2@gmail.com", "mobile": "01298765432", "district": null, "lastName": "حمص وحلاوة", "firstName": "ابو", "specialty": null, "profession": null, "governorate": "alexandria", "isAvailable": true, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-04-30 23:11:34.07');
INSERT INTO public.sessions VALUES ('76250bf5bf402632160ff9324d1c8ed043f51cff7c9a478ef0dae595835d9f2d', '{"user": {"id": "706dc1d9-d694-4e8c-99f6-ec64485af6e9", "area": "alex_montaza", "role": "client", "email": "hammo.beka2@gmail.com", "mobile": "01298765432", "district": null, "lastName": "حمص وحلاوة", "firstName": "ابو", "specialty": null, "profession": null, "governorate": "alexandria", "isAvailable": true, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-05-01 18:45:47.816');
INSERT INTO public.sessions VALUES ('07fb1c89463558bd842ba7d4630394375d59dcde20ee0685f114d13f063bce3e', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alex_montaza", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "district": "montaza", "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": "صيانة مكيفات", "profession": null, "governorate": "alexandria", "isAvailable": true, "profileImageUrl": null, "serviceCategories": ["ac"]}, "source": "user", "access_token": ""}', '2026-05-01 18:46:44.454');
INSERT INTO public.sessions VALUES ('d5fb524a4e5a92a7cd3122c1c371ff98702b9a5de3be5635ab2b9106aaff1c66', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alex_montaza", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "district": "montaza", "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": "صيانة مكيفات", "profession": null, "governorate": "alexandria", "isAvailable": true, "profileImageUrl": null, "serviceCategories": ["ac"]}, "source": "user", "access_token": ""}', '2026-05-02 17:04:55.629');
INSERT INTO public.sessions VALUES ('b1f9589e948933813b6f214e573f9f253dea3de2bf7fa6b20d0e23b07930a46b', '{"user": {"id": "379dc225-6cbd-4672-ae50-fc676ffc522b", "area": "alexandria__agamy", "role": "client", "email": "haitham@haitham.haitham", "mobile": "01551234567", "address": null, "district": null, "lastName": "فخرى", "firstName": "هيثم", "specialty": null, "profession": null, "governorate": "alexandria", "isAvailable": true, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-05-03 08:51:33.534');
INSERT INTO public.sessions VALUES ('deb3b6687cfaa7600f85ef0ab2ff365be968d72b7ffdc7e98a88fd5ec6252d36', '{"user": {"id": "d72a32d0-d012-4179-bfaa-65cc334eea4f", "area": "alexandria__agamy", "role": "technician", "email": "fanni@gmail.com", "mobile": "01112345678", "address": null, "district": null, "lastName": "عبد العظيم", "firstName": "احمد", "specialty": "Toilets & Sanitary", "profession": "Plumbing", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "e25069fa-dc48-41a4-b825-14fcbb4d1e96", "4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc"]}, "source": "user", "access_token": ""}', '2026-05-03 08:57:09.97');
INSERT INTO public.sessions VALUES ('64340e47216caa0801c741685d2b048090bcdc6e3b37ae5fa3a59fd6494c6e27', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null, "mustChangePassword": true}, "source": "admin", "access_token": ""}', '2026-05-03 23:06:55.659');
INSERT INTO public.sessions VALUES ('851ff366a44d510d17d616fff0e50770cdee88720d3b99f224e4b7ab34896bd5', '{"user": {"id": "3e00499d-f630-42af-a987-31604623ad77", "area": "alexandria__camp_shizar", "role": "client", "email": null, "mobile": "01174185296", "address": null, "district": null, "lastName": null, "firstName": "User1", "specialty": null, "profession": null, "serviceEnd": null, "governorate": "alexandria", "isAvailable": true, "serviceStart": null, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-05-06 13:36:24.24');
INSERT INTO public.sessions VALUES ('755c8c99ab7c8aa2232d33e7ee1cdc90a95223394dca1c65e446db5debc61277', '{"user": {"id": "1d2b4810-c915-4b5e-acb4-be1b2ecd583f", "area": "alexandria__al_ibrahimeyah", "role": "technician", "email": null, "mobile": "01215935786", "address": null, "district": null, "lastName": null, "firstName": "Test1", "specialty": "Doors & Windows", "profession": "Carpentry", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["e0d37eea-98ad-4135-859f-bdd7b04f767b"]}, "source": "user", "access_token": ""}', '2026-05-06 13:41:15.549');
INSERT INTO public.sessions VALUES ('545a11cfa81eef4c0249ef8b5870a397e9a9410437f05eb8cdb2c42524bf75ab', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alexandria__al_mandara", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "address": null, "district": "montaza", "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": "Maintenance", "profession": "Air Conditioning", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["ac", "6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc", "00d00019-6e65-48f7-be66-4a86e232f7b5", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901"]}, "source": "user", "access_token": ""}', '2026-05-13 15:05:58.28');
INSERT INTO public.sessions VALUES ('2b4b24b56ef53f14fef5cddd0ba3cec6d30c7e23d03ecd9f241bf12a31d1bbc6', '{"user": {"id": "e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac", "area": "alex_montaza", "role": "client", "email": "hammo.beka@gmail.com", "mobile": "01098765432", "address": null, "district": null, "lastName": "ابو حلاوة", "firstName": "حمص", "specialty": null, "profession": null, "serviceEnd": null, "governorate": "alexandria", "isAvailable": true, "serviceStart": null, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-05-13 19:53:00.641');
INSERT INTO public.sessions VALUES ('b1d4d9a60ef13da361252e038d3c7a7db77d26e1b94364e9177d5288a6182461', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alexandria__al_mandara", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "address": null, "district": "montaza", "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": "Maintenance", "profession": "Air Conditioning", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["ac", "6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc", "00d00019-6e65-48f7-be66-4a86e232f7b5", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901"]}, "source": "user", "access_token": ""}', '2026-06-07 18:13:16.824');
INSERT INTO public.sessions VALUES ('c79c0eb5b372ece304c041c6966ffe2f13e4c78115ca466f633c6cf44aae7c0b', '{"user": {"id": "e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac", "area": "alex_montaza", "role": "client", "email": "hammo.beka@gmail.com", "mobile": "01098765432", "address": null, "district": null, "lastName": "ابو حلاوة", "firstName": "حمص", "specialty": null, "profession": null, "serviceEnd": null, "governorate": "alexandria", "isAvailable": true, "serviceStart": null, "profileImageUrl": null, "serviceCategories": null}, "source": "user", "access_token": ""}', '2026-06-07 23:59:51.518');
INSERT INTO public.sessions VALUES ('26605225f391c382a9af6d5ad7e46437ddb0bd985ee03421821ff9c2ebc8d9df', '{"user": {"id": "17566df4-08e4-4965-a0df-2baf6e90149f", "area": "alexandria__al_mandara", "role": "technician", "email": "hamo.zabady@gmail.com", "mobile": "01012312312", "address": null, "district": "montaza", "lastName": "العنتبلي", "firstName": "حلاوة", "specialty": "Maintenance", "profession": "Air Conditioning", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["ac", "6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc", "00d00019-6e65-48f7-be66-4a86e232f7b5", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901"]}, "source": "user", "access_token": ""}', '2026-06-08 00:02:02.016');
INSERT INTO public.sessions VALUES ('846dd94aab356fae50ceef2eb33994f209fcce694d15e2f658a782b30940d88d', '{"user": {"id": "e14f0940-0a80-4b8d-8c30-090fa3ec7542", "bio": "فني محترف", "area": "alexandria__agamy", "role": "technician", "aptNo": "5", "email": "test_curl_fanni@example.com", "mobile": "01598765432", "rating": 0, "street": "شارع الاختبار", "address": null, "floorNo": "2", "district": null, "lastName": "فني", "latitude": null, "firstName": "تجربة", "longitude": null, "specialty": "Lighting", "buildingNo": "10", "isApproved": false, "profession": "Electricity", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "ratingCount": 0, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["6e76ea7b-784a-47f3-9dfe-45f92c821c3f"], "yearsOfExperience": 5, "mustChangePassword": false}, "source": "user", "access_token": ""}', '2026-06-28 22:15:31.813');
INSERT INTO public.sessions VALUES ('cb6e138042c687a38849b906e6b94246e29429df5de51a72dc49c11a3452bd00', '{"user": {"id": "b4aa88e3-0866-4349-b2e4-05ff74c4c111", "bio": null, "area": "alexandria__agamy", "role": "technician", "aptNo": "10", "email": "kawaree@gmail.com", "mobile": "01598765432", "rating": 0, "street": "Street 10", "address": null, "floorNo": "10", "district": null, "lastName": "مزارع", "latitude": null, "firstName": "كوارع", "longitude": null, "specialty": "Wiring & Circuits", "buildingNo": "10", "isApproved": false, "profession": "Electricity", "serviceEnd": "22:00", "governorate": "alexandria", "isAvailable": true, "ratingCount": 0, "serviceStart": "08:00", "profileImageUrl": null, "serviceCategories": ["6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901", "00d00019-6e65-48f7-be66-4a86e232f7b5"], "yearsOfExperience": 33, "mustChangePassword": false}, "source": "user", "access_token": ""}', '2026-06-29 00:26:24.466');
INSERT INTO public.sessions VALUES ('d2362e893f1dff7994e11c546dc9b659cf3b533477a96ebba650dc83e7cbe0e2', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null, "mustChangePassword": true}, "source": "admin", "access_token": ""}', '2026-06-29 11:49:49.205');
INSERT INTO public.sessions VALUES ('3afec2df602693bb80a7c162842e5b49a4d43363b11eff6061450f4a0ac661e0', '{"user": {"id": "f9196714-78a9-45bc-9457-20091ad18675", "area": null, "role": "admin", "email": "admin@fanni.app", "mobile": "admin", "district": null, "lastName": null, "firstName": "Admin", "specialty": null, "profession": null, "governorate": null, "profileImageUrl": null, "mustChangePassword": true}, "source": "admin", "access_token": ""}', '2026-06-30 08:53:59.963');


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: technician_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('57850587', 'contact.fakhry@gmail.com', 'Contact', 'Fakhry', 'https://lh3.googleusercontent.com/a/ACg8ocKAYG7Ix1obnUcuhqFluC9j3RSU-0RKm1XbTErH5uNOtazbqxA=s96-c', 'technician', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-22 13:52:42.04692+00', '2026-04-22 13:52:53.052+00', true, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('f17eecb4-9316-495d-9dc0-fa3efda9d54d', NULL, 'Test', 'User', NULL, 'technician', '01012345678', NULL, NULL, NULL, NULL, NULL, '2026-04-23 12:40:14.475888+00', '2026-04-23 12:46:11.9+00', true, '08827aa3c9dec2ce1271dafe2bcf86df:eec01d8867bb8f44de1a8435d21f205fd55beb30d2b5708a9a093ead0ab63b68e969a6fd2b8df90af85b2d05bbe1067e67a7ee86ba45b017dc5e8d640ef817af', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('17566df4-08e4-4965-a0df-2baf6e90149f', 'hamo.zabady@gmail.com', 'حلاوة', 'العنتبلي', NULL, 'technician', '01012312312', 'alexandria', 'alexandria__al_mandara', 'montaza', 'Air Conditioning', 'Maintenance', '2026-04-23 02:42:05.563113+00', '2026-05-31 18:14:40.094+00', true, '791cb2fe25ff8ae8441eb3d653b3906e:2b64ffffe1a8936e3c5f8bf1f328a4a43f686e81cdecb41b2f69f3171e81e0b3d27ca80a2d81105c8ecb6042e8e19fa08c87cb9c59f3a97734279dceffb9bfa6', true, '0101000020E6100000C00A4B9759033E40EA53331070473F40', '["ac", "6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc", "00d00019-6e65-48f7-be66-4a86e232f7b5", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901"]', NULL, '08:00', '22:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('d72a32d0-d012-4179-bfaa-65cc334eea4f', 'fanni@gmail.com', 'احمد', 'عبد العظيم', NULL, 'technician', '01112345678', 'alexandria', 'alexandria__agamy', NULL, 'Plumbing', 'Toilets & Sanitary', '2026-04-26 08:57:09.953201+00', '2026-04-26 08:57:10.297+00', true, 'b7d213816c5038871f3f8c4e78040c24:9f96199105c52b474d0bf099c0bd08a35e7b679941950fb4479cab14c09fb34650293eff4f2feb6d34af44d9a12241a5b7dcec72d22bad8fc74f05146b545da7', true, '0101000020E610000015127A47D7C63D408278B878D31C3F40', '["6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "e25069fa-dc48-41a4-b825-14fcbb4d1e96", "4ed58d43-d1bb-40f9-ba56-64b89b5fc1bc"]', NULL, '08:00', '22:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('5fd3620b-e927-46bb-a9a2-05d0043225d2', 'contact.haitham@gmail.com', 'احمد', 'عوض الدسوقى', NULL, 'client', '01230123012', 'alexandria', 'alex_montaza', NULL, NULL, NULL, '2026-04-22 23:50:31.161897+00', '2026-04-22 23:50:31.161897+00', true, '8c316246d728cc5434165ed79ca2c43a:4b367d5051dc0162b796b62f807985725c98b3fc3157f2e1c266f90eac618b4fa4b8ecfdf20e60ff9ccb05cf56bdec1b25afe2950ec07c406ec9330aa14fa245', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('706dc1d9-d694-4e8c-99f6-ec64485af6e9', 'hammo.beka2@gmail.com', 'ابو', 'حمص وحلاوة', NULL, 'client', '01298765432', 'alexandria', 'alex_montaza', NULL, NULL, NULL, '2026-04-23 12:44:30.97305+00', '2026-04-23 12:44:30.97305+00', true, '9660c40f51d4447ed43cb46559b9067c:fd689bbc48c2b24430ca6bfa2ed5a0b0bfa80a98ddb3cb592cf2b525f248156a324714152e3c811a86d07389dc250b25d1c7453fbe8afd35b69d5efed616992c', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('b0b499c5-3337-4bf7-8f79-6a991436dca7', NULL, 'OTP', 'Test User', NULL, 'client', '01099887766', NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:10:43.876319+00', '2026-04-23 13:10:43.876319+00', true, '82d2c686f82a9eba4147aa9354d9608a:28339d5f8534a7620e0f7f95e9058571a4f76c3d7333ccbff243d3afe116ca61dc76f46569eaa2f088bd285d177bf3b0ae29a124179a1530ca1bb5f9c3cbc2e7', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('1d2b4810-c915-4b5e-acb4-be1b2ecd583f', NULL, 'Test1', NULL, NULL, 'technician', '01215935786', 'alexandria', 'alexandria__al_ibrahimeyah', NULL, 'Carpentry', 'Doors & Windows', '2026-04-29 13:08:26.322104+00', '2026-04-29 13:59:32.715+00', true, 'd86ebf7f31a1a1555b9cdfcf58c975c7:c1cb7745447b24abc51ca3be907a72b038a4d1475c7b2465fdd92150684f835329749a8d98f04f85cb761e332efcedd5d97f383ca61ffe5d5ab94922e4ea4fcd', true, NULL, '["e0d37eea-98ad-4135-859f-bdd7b04f767b"]', 'شارع ابوقير', '08:00', '22:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('98edcb00-3f5d-41ae-a6c2-3ea5247108b8', NULL, 'Dev', 'Skip User', NULL, 'client', '01033445566', NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:17:01.243164+00', '2026-04-23 13:17:01.243164+00', true, '947810037f2322990ed5211417f99ef0:0bc655364ac4687d10c60033ba9efff571200a1211881d44598c78d53b07923f8765b1d3c0c6c04739a2863a05f0c1cee037b9f7b2f6a6d7198182679b792afa', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('ffe4a7f2-0228-40d1-ba45-3cf0a497b034', NULL, 'OTP', 'Full User', NULL, 'client', '01011223344', NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:17:01.51566+00', '2026-04-23 13:17:01.51566+00', true, '21a09b51130292ca0fab132712c96fff:253a07fbf08450a72f758e4171533606a19af34eda5ca5333912e5db148acd165e7249118881c1483481c01fe1dd4b3e2ce529e15d05bce2c3f0dbd0bed59e4c', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('fe4d83fc-d3c2-40c1-9854-247bd3e7ddcb', NULL, 'JWT', 'Test User', NULL, 'client', '01022334455', NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:22:43.125465+00', '2026-04-23 13:22:43.125465+00', true, 'bfb3cfa511b6efc8676cff6919a1aa2c:f4426c3c3334a464a0f779dd88d41196c9eb0a68a64f9e341138d12261fd2974be37db72c9a5734e6783892c8b23e86a207ce295493012c899342f9e56e7adc1', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('3e00499d-f630-42af-a987-31604623ad77', NULL, 'User1', NULL, NULL, 'client', '01174185296', 'alexandria', 'alexandria__camp_shizar', NULL, NULL, NULL, '2026-04-29 13:15:57.413+00', '2026-04-29 13:15:57.413+00', true, '16f3192dd28ac42ef78a7d7689fca807:84021c5cb3def751f7f3585de58e869ca8779667eea5ea9bac070ca1bf221dcceebd501d56d94187a85f4e95f5d233891c2dc4d6b52d4f6f31ced8641aed0267', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('e2f9d1a0-66ff-4e84-893e-5ee5cb1830ac', 'hammo.beka@gmail.com', 'حمص', 'ابو حلاوة', NULL, 'client', '01098765432', 'alexandria', 'alexandria__abu_qir', NULL, NULL, NULL, '2026-04-23 02:46:39.444302+00', '2026-06-01 00:01:41.049+00', true, 'facfddafb33de5de2c5ddd079e175c63:8ae995c74e4beae07c2384d76f10adaa3cd760b9636a1b5a31a0f47595887a3c1c9af2f104c2f3109f635489aa06774b966276808a44b9079afc7bc2a10e34a7', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('379dc225-6cbd-4672-ae50-fc676ffc522b', 'haitham@haitham.haitham', 'هيثم', 'فخرى', NULL, 'client', '01551234567', 'alexandria', 'alexandria__agamy', NULL, NULL, NULL, '2026-04-26 08:51:33.482603+00', '2026-04-26 08:51:33.482603+00', true, '00c793a9b21e994c714f1414ec0bed60:bc19315a0f7158072c50226d78fba02431be16eacb8209121f0518b12333748253fd25d00d6791ea53b181bc233880c6db04cad302906546f51f2ff713ba9953', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 0.00, 0);
INSERT INTO public.users VALUES ('b4aa88e3-0866-4349-b2e4-05ff74c4c111', 'kawaree@gmail.com', 'كوارع', 'مزارع', NULL, 'technician', '01598765432', 'alexandria', 'alexandria__agamy', NULL, 'Electricity', 'Wiring & Circuits', '2026-06-22 00:26:24.430626+00', '2026-06-22 00:26:24.430626+00', true, '89f5e6131142383a798f5269f97b9676:0f0f5c83eb48ec226739ce678360e5060a00ea20339c1a7ea6195e84646341d9b0c4807703ef212c4cb2ada2ed02e79d35f960a70dc6267ff8b0ade7cf7a8300', true, '0101000020E6100000FFFF9FFFF3C63D4051B0C3740F213F40', '["6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901", "00d00019-6e65-48f7-be66-4a86e232f7b5"]', NULL, '08:00', '22:00', NULL, 'Street 10', '10', '10', '10', NULL, NULL, NULL, NULL, false, NULL, 33, 0.00, 0);
INSERT INTO public.users VALUES ('c5498cfd-3134-4bb9-8271-d7cf5ca8a641', 'ggsg@gmail.com', 'جاي', 'على نفسي', NULL, 'technician', '01212345678', 'alexandria', 'alexandria__agamy', NULL, 'Electricity', 'Electrical Panel', '2026-06-22 11:46:23.690047+00', '2026-06-22 11:49:07.152+00', true, 'c53d66e5716f6737043506d8f9f5e6ee:74dff4004ec519579cd2241ce1d9b0bcb16c22627ebd9f0d413e6f873ed2381de34ffe2635f681620a00a25355daae3da53427e60796c13ae60182915e4fb400', true, '0101000020E6100000FFFFBF3F57C73D40A10B55335E203F40', '["6e76ea7b-784a-47f3-9dfe-45f92c821c3f", "29acdc5e-6c9a-4495-b0c9-23d7cfc9d901", "00d00019-6e65-48f7-be66-4a86e232f7b5"]', 'Street 2, Bldg: 31, Flr: 10, Apt: 14', '08:00', '22:00', NULL, 'Street 2', '33', '5', '5', NULL, NULL, NULL, NULL, false, NULL, 25, 0.00, 0);


--
-- Name: availability_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.availability_audit_logs_id_seq', 4, true);


--
-- Name: invoices_invoice_serial_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoices_invoice_serial_seq', 1, false);


--
-- Name: login_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.login_logs_id_seq', 54, true);


--
-- Name: orders_order_serial_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_serial_seq', 8, true);


--
-- Name: rate_limits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rate_limits_id_seq', 95, true);


--
-- Name: admins admins_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_unique UNIQUE (email);


--
-- Name: admins admins_mobile_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_mobile_unique UNIQUE (mobile);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: availability_audit_logs availability_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_audit_logs
    ADD CONSTRAINT availability_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_serial_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_serial_unique UNIQUE (invoice_serial);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: location_aliases location_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_aliases
    ADD CONSTRAINT location_aliases_pkey PRIMARY KEY (id);


--
-- Name: location_miss_log location_miss_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_miss_log
    ADD CONSTRAINT location_miss_log_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: login_logs login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);


--
-- Name: nominatim_cache nominatim_cache_cache_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nominatim_cache
    ADD CONSTRAINT nominatim_cache_cache_key_unique UNIQUE (cache_key);


--
-- Name: nominatim_cache nominatim_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nominatim_cache
    ADD CONSTRAINT nominatim_cache_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_serial_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_serial_unique UNIQUE (order_serial);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: phone_verifications phone_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.phone_verifications
    ADD CONSTRAINT phone_verifications_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: service_domains service_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_domains
    ADD CONSTRAINT service_domains_pkey PRIMARY KEY (id);


--
-- Name: service_specializations service_specializations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_specializations
    ADD CONSTRAINT service_specializations_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: technician_notifications technician_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technician_notifications
    ADD CONSTRAINT technician_notifications_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_invoices_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_invoices_client" ON public.invoices USING btree (client_id);


--
-- Name: IDX_invoices_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_invoices_order" ON public.invoices USING btree (order_id);


--
-- Name: IDX_invoices_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_invoices_serial" ON public.invoices USING btree (invoice_serial);


--
-- Name: IDX_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_invoices_status" ON public.invoices USING btree (status);


--
-- Name: IDX_invoices_tech; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_invoices_tech" ON public.invoices USING btree (technician_id);


--
-- Name: IDX_invoices_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_invoices_type" ON public.invoices USING btree (invoice_type);


--
-- Name: IDX_loc_miss_city_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_loc_miss_city_en" ON public.location_miss_log USING btree (city_en);


--
-- Name: IDX_loc_miss_last_seen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_loc_miss_last_seen" ON public.location_miss_log USING btree (last_seen_at);


--
-- Name: IDX_loc_miss_suburb_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_loc_miss_suburb_en" ON public.location_miss_log USING btree (suburb_en);


--
-- Name: IDX_location_aliases_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_location_aliases_alias" ON public.location_aliases USING btree (alias);


--
-- Name: IDX_location_aliases_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_location_aliases_location" ON public.location_aliases USING btree (location_id);


--
-- Name: IDX_locations_centroid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_locations_centroid" ON public.locations USING gist (centroid) WHERE (centroid IS NOT NULL);


--
-- Name: IDX_locations_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_locations_parent" ON public.locations USING btree (parent_id);


--
-- Name: IDX_locations_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_locations_slug" ON public.locations USING btree (slug);


--
-- Name: IDX_locations_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_locations_type" ON public.locations USING btree (type);


--
-- Name: IDX_nominatim_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_nominatim_expires" ON public.nominatim_cache USING btree (expires_at);


--
-- Name: IDX_nominatim_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_nominatim_key" ON public.nominatim_cache USING btree (cache_key);


--
-- Name: IDX_orders_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_orders_client" ON public.orders USING btree (client_id);


--
-- Name: IDX_orders_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_orders_serial" ON public.orders USING btree (order_serial);


--
-- Name: IDX_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_orders_status" ON public.orders USING btree (status);


--
-- Name: IDX_orders_tech; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_orders_tech" ON public.orders USING btree (technician_id);


--
-- Name: IDX_phone_verif_mobile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_phone_verif_mobile" ON public.phone_verifications USING btree (mobile);


--
-- Name: IDX_reset_token_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_reset_token_user" ON public.password_reset_tokens USING btree (user_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: availability_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX availability_audit_logs_created_at_idx ON public.availability_audit_logs USING btree (created_at);


--
-- Name: availability_audit_logs_tech_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX availability_audit_logs_tech_id_idx ON public.availability_audit_logs USING btree (technician_id);


--
-- Name: login_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX login_logs_user_id_idx ON public.login_logs USING btree (user_id);


--
-- Name: rate_limits_key_hit_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rate_limits_key_hit_at_idx ON public.rate_limits USING btree (key, hit_at);


--
-- Name: service_specializations_domain_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX service_specializations_domain_id_idx ON public.service_specializations USING btree (domain_id);


--
-- Name: technician_notifications_technician_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX technician_notifications_technician_id_idx ON public.technician_notifications USING btree (technician_id) WHERE (delivered_at IS NULL);


--
-- Name: uq_loc_miss_terms; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_loc_miss_terms ON public.location_miss_log USING btree (COALESCE(suburb_en, ''::character varying), COALESCE(suburb_ar, ''::character varying), COALESCE(city_en, ''::character varying), COALESCE(city_ar, ''::character varying));


--
-- Name: uq_location_aliases_location_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_location_aliases_location_alias ON public.location_aliases USING btree (location_id, alias);


--
-- Name: invoices invoices_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_technician_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_technician_id_users_id_fk FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.service_specializations(id) ON DELETE SET NULL;


--
-- Name: orders orders_technician_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_technician_id_users_id_fk FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: technician_notifications technician_notifications_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technician_notifications
    ADD CONSTRAINT technician_notifications_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict kH4sdSgYtVcYjrgWJmL4mL88NJsBxSE6Q9qFVnqh1BIdljhZYQABCDJ4sQaLDR8

