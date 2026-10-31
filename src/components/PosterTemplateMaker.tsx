import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateSamplePortraitDataUrl } from '../constants';

export type PosterCategory =
  | 'all'
  | 'wedding'
  | 'anniversary'
  | 'engagement'
  | 'birthday'
  | 'memorial'
  | 'festival';

export type PhotoSlotShape = 'rect' | 'rounded' | 'arch' | 'circle' | 'oval' | 'octagon';

export type PhotoFrameStyle =
  | 'gold-double'
  | 'floral-wreath'
  | 'ornate-corner'
  | 'garland-tribute'
  | 'silver-luxury'
  | 'polaroid-white'
  | 'rose-gold';

export interface PhotoSlotSpec {
  id: string;
  label: string;
  x: number; // normalized 0..1080 canvas coordinate
  y: number; // normalized 0..1350 canvas coordinate
  width: number;
  height: number;
  shape: PhotoSlotShape;
  frameStyle: PhotoFrameStyle;
  accentColor: string;
  defaultSampleIndex: number;
}

export interface TextFieldSpec {
  id: string;
  label: string;
  defaultValue: string;
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
  fontFamily: 'serif' | 'sans' | 'display' | 'script' | 'mono';
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right';
  uppercase?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  maxLines?: number;
  pillBgColor?: string;
}

export type PosterDecorMotif =
  | 'royal-mandala-arch'
  | 'temple-kalash-gold'
  | 'floral-botanical-corners'
  | 'silver-jubilee-sparkles'
  | 'golden-jubilee-crest'
  | 'ring-ceremony-geometric'
  | 'birthday-confetti-crown'
  | 'kids-carnival-bunting'
  | 'memorial-lotus-diya'
  | 'memorial-garland-pillar'
  | 'memorial-dove-cross'
  | 'festival-diwali-diyas'
  | 'festival-eid-crescent'
  | 'festival-christmas-wreath'
  | 'festival-traditional-toran';

export interface PosterTemplateSpec {
  id: string;
  name: string;
  category: Exclude<PosterCategory, 'all'>;
  categoryLabel: string;
  badge: string;
  canvasWidth: number;
  canvasHeight: number;
  bgColors: [string, string, string];
  bgPattern: 'mandala' | 'damask' | 'bokeh' | 'rays' | 'minimal-linen' | 'velvet-vignette';
  outerBorderStyle: 'royal-gold' | 'double-line' | 'floral-frame' | 'temple-border' | 'dignified-frame' | 'festive-toran';
  primaryAccent: string;
  secondaryAccent: string;
  decorMotif: PosterDecorMotif;
  photoSlots: PhotoSlotSpec[];
  textFields: TextFieldSpec[];
}

export interface PhotoSlotTransform {
  imageUrl: string;
  imageElement: HTMLImageElement | null;
  zoom: number; // 50 to 300 (%)
  panX: number; // px offset inside slot
  panY: number; // px offset inside slot
  rotation: number; // -180 to 180 deg
  flipX: boolean;
  brightness: number; // 60 to 140 (%)
  contrast: number; // 60 to 140 (%)
  cropInset: number; // 0 to 25 (% inner crop margin)
}

export interface TextFieldOverride {
  text: string;
  color: string;
  fontScale: number; // 70 to 140 (%)
}

// ============================================================================
// 36 PROFESSIONALLY DESIGNED EDITABLE POSTER TEMPLATES (6 CATEGORIES × 6)
// ============================================================================
export const POSTER_TEMPLATES: PosterTemplateSpec[] = [
  // --------------------------------------------------------------------------
  // CATEGORY 1: WEDDING INVITATION TEMPLATES (6 Templates)
  // --------------------------------------------------------------------------
  {
    id: 'wed-01-royal-crimson-arch',
    name: 'Royal Crimson & Gold Arch Couple Invitation',
    category: 'wedding',
    categoryLabel: 'Wedding Invitation',
    badge: 'Left Couple Photo + Right Text',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#450a0a', '#7f1d1d', '#2a0505'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#fef08a',
    decorMotif: 'royal-mandala-arch',
    photoSlots: [
      {
        id: 'couple-main',
        label: 'Couple Photo (Left Arch)',
        x: 75,
        y: 260,
        width: 430,
        height: 760,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Auspicious Header',
        defaultValue: '✦ CORDIAL WEDDING INVITATION ✦',
        x: 540,
        y: 120,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
        uppercase: true,
      },
      {
        id: 'family_line',
        label: 'Invitation Line',
        defaultValue: 'Together with our families, we joyfully invite you to celebrate the wedding of',
        x: 545,
        y: 310,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fef3c7',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'bride_groom',
        label: 'Bride & Groom Names',
        defaultValue: 'AARAV  &  ANANYA',
        x: 545,
        y: 465,
        maxWidth: 460,
        fontSize: 54,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.15,
      },
      {
        id: 'datetime',
        label: 'Wedding Date & Time',
        defaultValue: 'SUNDAY, 24 NOVEMBER 2026\nMuhurtham: 10:30 AM Onwards',
        x: 545,
        y: 660,
        maxWidth: 450,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'venue',
        label: 'Venue / Location',
        defaultValue: 'Grand Royal Palace Convention Hall,\nMG Road, Chikmagalur, Karnataka',
        x: 545,
        y: 825,
        maxWidth: 450,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde68a',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'message',
        label: 'Custom Blessing / RSVP',
        defaultValue: 'Compliments From: Near & Dear — RSVP: +91 98450 11223',
        x: 540,
        y: 1210,
        maxWidth: 920,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fef08a',
        align: 'center',
        pillBgColor: 'rgba(251, 191, 36, 0.16)',
      },
    ],
  },
  {
    id: 'wed-02-dual-portrait-heritage',
    name: 'Heritage Gold Dual Portrait Bride & Groom Invite',
    category: 'wedding',
    categoryLabel: 'Wedding Invitation',
    badge: '2 Photo Areas (Bride & Groom)',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#3b0764', '#581c87', '#1e1b4b'],
    bgPattern: 'damask',
    outerBorderStyle: 'temple-border',
    primaryAccent: '#f59e0b',
    secondaryAccent: '#fde68a',
    decorMotif: 'temple-kalash-gold',
    photoSlots: [
      {
        id: 'groom-slot',
        label: 'Groom Portrait (Left Oval)',
        x: 110,
        y: 250,
        width: 360,
        height: 440,
        shape: 'oval',
        frameStyle: 'ornate-corner',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'bride-slot',
        label: 'Bride Portrait (Right Oval)',
        x: 610,
        y: 250,
        width: 360,
        height: 440,
        shape: 'oval',
        frameStyle: 'ornate-corner',
        accentColor: '#fbbf24',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header Blessing',
        defaultValue: 'SHUBH VIVAH · AUSPICIOUS WEDDING CEREMONY',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Groom & Bride Names',
        defaultValue: 'ROHAN GOWDA   weds   KAVYA RAO',
        x: 540,
        y: 785,
        maxWidth: 920,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Parents / Invitation Note',
        defaultValue: 'We cordially request the honor of your presence & blessings on the joyous occasion',
        x: 540,
        y: 865,
        maxWidth: 860,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#f3e8ff',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Muhurtham Time',
        defaultValue: 'THURSDAY, 10 DECEMBER 2026 AT 11:15 AM',
        x: 540,
        y: 970,
        maxWidth: 880,
        fontSize: 30,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        pillBgColor: 'rgba(245, 158, 11, 0.22)',
      },
      {
        id: 'venue',
        label: 'Wedding Venue',
        defaultValue: 'Venue: Sri Chamundeshwari Kalyana Mantapa, Hassan Road, Chikmagalur',
        x: 540,
        y: 1090,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer / Reception Info',
        defaultValue: 'Reception: Evening 7:00 PM Onwards · Warm Regards: Gowda & Rao Family',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 20,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#e9d5ff',
        align: 'center',
      },
    ],
  },
  {
    id: 'wed-03-emerald-palace-trio',
    name: 'Emerald Palace 3-Photo Grand Wedding Poster',
    category: 'wedding',
    categoryLabel: 'Wedding Invitation',
    badge: '3 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#022c22', '#064e3b', '#042f2e'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#a7f3d0',
    decorMotif: 'royal-mandala-arch',
    photoSlots: [
      {
        id: 'main-couple',
        label: 'Main Couple Portrait (Center Arch)',
        x: 330,
        y: 195,
        width: 420,
        height: 520,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'side-left',
        label: 'Left Side Portrait',
        x: 75,
        y: 280,
        width: 225,
        height: 360,
        shape: 'rounded',
        frameStyle: 'ornate-corner',
        accentColor: '#fbbf24',
        defaultSampleIndex: 1,
      },
      {
        id: 'side-right',
        label: 'Right Side Portrait',
        x: 780,
        y: 280,
        width: 225,
        height: 360,
        shape: 'rounded',
        frameStyle: 'ornate-corner',
        accentColor: '#fbbf24',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Header',
        defaultValue: 'ROYAL WEDDING & RECEPTION CELEBRATION',
        x: 540,
        y: 115,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'VIKRAM ADITYA  &  MEERA NAIR',
        x: 540,
        y: 800,
        maxWidth: 920,
        fontSize: 52,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Invitation Message',
        defaultValue: 'Solicit your gracious presence with family & friends on the auspicious wedding ceremony',
        x: 540,
        y: 880,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#d1fae5',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'WEDNESDAY, 18 NOVEMBER 2026 · 12:05 PM',
        x: 540,
        y: 980,
        maxWidth: 860,
        fontSize: 29,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        pillBgColor: 'rgba(251, 191, 36, 0.2)',
      },
      {
        id: 'venue',
        label: 'Venue Address',
        defaultValue: 'Emerald Hills Luxury Resort & Lawn, Madikeri Road, Coorg',
        x: 540,
        y: 1095,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer Credit / RSVP',
        defaultValue: 'Best Compliments From: Friends & Relatives · Live Stream by MALNADU MEDIA',
        x: 540,
        y: 1215,
        maxWidth: 900,
        fontSize: 20,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#a7f3d0',
        align: 'center',
      },
    ],
  },
  {
    id: 'wed-04-ivory-floral-christian',
    name: 'Ivory & Rose Gold Floral Christian Wedding Card',
    category: 'wedding',
    categoryLabel: 'Wedding Invitation',
    badge: 'Left Photo + Right Script',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#fffbeb', '#fef3c7', '#fdf2f8'],
    bgPattern: 'minimal-linen',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#be185d',
    secondaryAccent: '#b45309',
    decorMotif: 'floral-botanical-corners',
    photoSlots: [
      {
        id: 'couple-oval',
        label: 'Couple Portrait (Left Rounded)',
        x: 85,
        y: 265,
        width: 420,
        height: 750,
        shape: 'rounded',
        frameStyle: 'rose-gold',
        accentColor: '#be185d',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Scripture / Header',
        defaultValue: '“What God has joined together, let no one separate”',
        x: 540,
        y: 135,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '600',
        color: '#9d174d',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Host Line',
        defaultValue: 'Mr. & Mrs. Thomas D’Souza cordially invite you to the Holy Matrimony of',
        x: 545,
        y: 330,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#475569',
        align: 'left',
      },
      {
        id: 'bride_groom',
        label: 'Bride & Groom Names',
        defaultValue: 'JONATHAN\n&  RACHEL',
        x: 545,
        y: 475,
        maxWidth: 450,
        fontSize: 56,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#831843',
        align: 'left',
        lineHeight: 1.15,
      },
      {
        id: 'datetime',
        label: 'Nuptial Mass Date & Time',
        defaultValue: 'SATURDAY, 12 DECEMBER 2026\nNuptial Blessing at 4:00 PM',
        x: 545,
        y: 690,
        maxWidth: 450,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#b45309',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Church & Reception Venue',
        defaultValue: 'St. Joseph’s Cathedral Church,\nFollowed by Reception at Emerald Lawn',
        x: 545,
        y: 855,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#334155',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Bottom Note',
        defaultValue: 'Your prayers and gracious presence are our greatest gift',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#9d174d',
        align: 'center',
      },
    ],
  },
  {
    id: 'wed-05-south-indian-muhurtham',
    name: 'South Indian Temple Gold Muhurtham Poster',
    category: 'wedding',
    categoryLabel: 'Wedding Invitation',
    badge: 'Right Couple Photo + Left Text',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#7c2d12', '#9a3412', '#431407'],
    bgPattern: 'mandala',
    outerBorderStyle: 'temple-border',
    primaryAccent: '#facc15',
    secondaryAccent: '#fed7aa',
    decorMotif: 'temple-kalash-gold',
    photoSlots: [
      {
        id: 'right-couple-arch',
        label: 'Couple Photo (Right Arch)',
        x: 575,
        y: 255,
        width: 425,
        height: 760,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#facc15',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Auspicious Header',
        defaultValue: '|| SRI GANESHAYA NAMAHA · SUBHA MUHURTHAM ||',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Bride & Groom Names',
        defaultValue: 'KARTHIK SHETTY\nWeds\nDIVYA HEGDE',
        x: 85,
        y: 330,
        maxWidth: 455,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#facc15',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'family_line',
        label: 'Invitation Text',
        defaultValue: 'We cordially invite you and your family to grace the auspicious wedding ceremony',
        x: 85,
        y: 590,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#ffedd5',
        align: 'left',
      },
      {
        id: 'datetime',
        label: 'Muhurtham Date & Time',
        defaultValue: 'FRIDAY, 04 DECEMBER 2026\nAbhijit Lagna: 11:45 AM',
        x: 85,
        y: 745,
        maxWidth: 455,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Kalyana Mantapa Venue',
        defaultValue: 'Sri Dharmasthala Manjunatheshwara\nKalyana Mantapa, Udupi - Mangalore Hwy',
        x: 85,
        y: 895,
        maxWidth: 455,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fef08a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer Blessing',
        defaultValue: 'With Best Compliments From: Shetty & Hegde Family',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#facc15',
        align: 'center',
        pillBgColor: 'rgba(250, 204, 21, 0.16)',
      },
    ],
  },
  {
    id: 'wed-06-save-the-date-magazine',
    name: 'Luxury Save The Date Dual Frame Wedding Poster',
    category: 'wedding',
    categoryLabel: 'Wedding Invitation',
    badge: '2 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#0f172a', '#1e293b', '#090d16'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'double-line',
    primaryAccent: '#38bdf8',
    secondaryAccent: '#fbbf24',
    decorMotif: 'royal-mandala-arch',
    photoSlots: [
      {
        id: 'hero-left',
        label: 'Primary Couple Photo (Left)',
        x: 85,
        y: 235,
        width: 520,
        height: 640,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'inset-right',
        label: 'Secondary Portrait (Right)',
        x: 635,
        y: 350,
        width: 360,
        height: 460,
        shape: 'arch',
        frameStyle: 'silver-luxury',
        accentColor: '#38bdf8',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Kicker',
        defaultValue: 'SAVE THE DATE · WE ARE GETTING MARRIED',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#38bdf8',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'SIDDHARTH  &  ISHITA',
        x: 540,
        y: 965,
        maxWidth: 920,
        fontSize: 56,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Wedding Date & Time',
        defaultValue: '28 · 12 · 2026  |  06:30 PM ONWARDS',
        x: 540,
        y: 1055,
        maxWidth: 880,
        fontSize: 32,
        fontFamily: 'mono',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Venue Location',
        defaultValue: 'Taj West End Grand Ballroom, Race Course Road, Bengaluru',
        x: 540,
        y: 1140,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#bae6fd',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Custom Footer Note',
        defaultValue: 'Formal Invitation to Follow · #SiddharthWedsIshita',
        x: 540,
        y: 1220,
        maxWidth: 880,
        fontSize: 20,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORY 2: WEDDING ANNIVERSARY TEMPLATES (6 Templates)
  // --------------------------------------------------------------------------
  {
    id: 'ann-01-silver-jubilee-then-now',
    name: '25th Silver Jubilee "Then & Now" Dual Photo Poster',
    category: 'anniversary',
    categoryLabel: 'Wedding Anniversary',
    badge: '2 Photos (Then & Now)',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#0f172a', '#1e293b', '#334155'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'double-line',
    primaryAccent: '#e2e8f0',
    secondaryAccent: '#38bdf8',
    decorMotif: 'silver-jubilee-sparkles',
    photoSlots: [
      {
        id: 'photo-then',
        label: 'Wedding Day Photo ("Then" - Left)',
        x: 95,
        y: 260,
        width: 410,
        height: 500,
        shape: 'arch',
        frameStyle: 'silver-luxury',
        accentColor: '#e2e8f0',
        defaultSampleIndex: 0,
      },
      {
        id: 'photo-now',
        label: 'Current Couple Photo ("Now" - Right)',
        x: 575,
        y: 260,
        width: 410,
        height: 500,
        shape: 'arch',
        frameStyle: 'silver-luxury',
        accentColor: '#38bdf8',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Anniversary Milestone',
        defaultValue: '✦ CELEBRATING 25 YEARS OF LOVE & TOGETHERNESS ✦',
        x: 540,
        y: 125,
        maxWidth: 920,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#bae6fd',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'HAPPY 25th SILVER JUBILEE\nMR. & MRS. RAJESHWAR RAO',
        x: 540,
        y: 845,
        maxWidth: 920,
        fontSize: 44,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
        lineHeight: 1.25,
      },
      {
        id: 'datetime',
        label: 'Anniversary Date & Time',
        defaultValue: '1999 — 2024  |  SUNDAY, 22 NOVEMBER AT 7:00 PM',
        x: 540,
        y: 1005,
        maxWidth: 880,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#38bdf8',
        align: 'center',
        pillBgColor: 'rgba(56, 189, 248, 0.16)',
      },
      {
        id: 'venue',
        label: 'Celebration Venue',
        defaultValue: 'Silver Oak Banquet Hall, Hotel Grand Meridian, Mangaluru',
        x: 540,
        y: 1110,
        maxWidth: 880,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#e2e8f0',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Wishes From Family',
        defaultValue: 'With Love & Best Wishes From: Children, Grandchildren & Family',
        x: 540,
        y: 1215,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#cbd5e1',
        align: 'center',
      },
    ],
  },
  {
    id: 'ann-02-golden-jubilee-50th',
    name: '50th Golden Jubilee Royal 3-Photo Celebration',
    category: 'anniversary',
    categoryLabel: 'Wedding Anniversary',
    badge: '3 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#422006', '#713f12', '#1c1917'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#facc15',
    secondaryAccent: '#fef08a',
    decorMotif: 'golden-jubilee-crest',
    photoSlots: [
      {
        id: 'center-couple',
        label: 'Main Couple Portrait (Center Circle)',
        x: 330,
        y: 210,
        width: 420,
        height: 420,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#facc15',
        defaultSampleIndex: 0,
      },
      {
        id: 'memory-left',
        label: 'Left Memory Photo',
        x: 80,
        y: 340,
        width: 220,
        height: 280,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fde047',
        defaultSampleIndex: 1,
      },
      {
        id: 'memory-right',
        label: 'Right Memory Photo',
        x: 780,
        y: 340,
        width: 220,
        height: 280,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fde047',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Banner',
        defaultValue: '50 GOLDEN YEARS OF BLESSED MARRIAGE',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'SHRI SUNDARESHAN & SMT. LAKSHMI DEVI',
        x: 540,
        y: 745,
        maxWidth: 920,
        fontSize: 44,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#facc15',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Tribute Quote',
        defaultValue: 'Five decades of love, sacrifice, and building a beautiful family legacy together.',
        x: 540,
        y: 830,
        maxWidth: 860,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fef9c3',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Golden Jubilee Date & Time',
        defaultValue: 'GOLDEN JUBILEE DINNER · SATURDAY, 14 NOV 2026 AT 6:30 PM',
        x: 540,
        y: 950,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        pillBgColor: 'rgba(250, 204, 21, 0.22)',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Golden Palms Convention Center, Kuvempunagar, Mysuru',
        x: 540,
        y: 1075,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Family Footer',
        defaultValue: 'Hosted with Gratitude by Sons, Daughters-in-law & Grandchildren',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fef08a',
        align: 'center',
      },
    ],
  },
  {
    id: 'ann-03-romantic-left-couple',
    name: 'Romantic Champagne & Gold Left-Photo Anniversary Poster',
    category: 'anniversary',
    categoryLabel: 'Wedding Anniversary',
    badge: 'Left Couple Photo + Right Text',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#1e1b4b', '#311042', '#090d16'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#f472b6',
    decorMotif: 'golden-jubilee-crest',
    photoSlots: [
      {
        id: 'couple-left',
        label: 'Couple Photo (Left Frame)',
        x: 80,
        y: 250,
        width: 430,
        height: 760,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Greeting',
        defaultValue: 'HAPPY WEDDING ANNIVERSARY',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#f472b6',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'ARJUN NAIR\n&\nPRIYA MENON',
        x: 545,
        y: 350,
        maxWidth: 455,
        fontSize: 50,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'family_line',
        label: 'Anniversary Wish',
        defaultValue: 'Wishing a wonderful couple many more years of happiness, laughter, and endless love!',
        x: 545,
        y: 620,
        maxWidth: 450,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fce7f3',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'datetime',
        label: 'Date',
        defaultValue: 'CELEBRATING 10 WONDERFUL YEARS\n20 NOVEMBER 2026',
        x: 545,
        y: 800,
        maxWidth: 450,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Party Venue / Location',
        defaultValue: 'Evening Dinner at Skydeck Lounge, Kochi',
        x: 545,
        y: 930,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Sender Name',
        defaultValue: 'Warmest Wishes From: All Family Members & Friends',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fbbf24',
        align: 'center',
      },
    ],
  },
  {
    id: 'ann-04-ruby-40th-collage',
    name: 'Ruby Red 40th Anniversary 3-Photo Collage',
    category: 'anniversary',
    categoryLabel: 'Wedding Anniversary',
    badge: '3 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#4c0519', '#881337', '#2e0210'],
    bgPattern: 'damask',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#fb7185',
    secondaryAccent: '#fde047',
    decorMotif: 'floral-botanical-corners',
    photoSlots: [
      {
        id: 'ruby-main',
        label: 'Main Couple Photo (Left Arch)',
        x: 80,
        y: 230,
        width: 450,
        height: 600,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fde047',
        defaultSampleIndex: 0,
      },
      {
        id: 'ruby-top-right',
        label: 'Memory Photo 1 (Top Right)',
        x: 570,
        y: 230,
        width: 430,
        height: 285,
        shape: 'rounded',
        frameStyle: 'rose-gold',
        accentColor: '#fb7185',
        defaultSampleIndex: 1,
      },
      {
        id: 'ruby-bottom-right',
        label: 'Memory Photo 2 (Bottom Right)',
        x: 570,
        y: 545,
        width: 430,
        height: 285,
        shape: 'rounded',
        frameStyle: 'rose-gold',
        accentColor: '#fb7185',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '40th RUBY WEDDING ANNIVERSARY CELEBRATION',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'MR. MATHEW PHILIP  &  MRS. ANNAMMA MATHEW',
        x: 540,
        y: 925,
        maxWidth: 920,
        fontSize: 42,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: '40 YEARS OF GRACE · SUNDAY, 29 NOV 2026 AT 12:30 PM',
        x: 540,
        y: 1015,
        maxWidth: 880,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Thanksgiving Prayer & Fellowship Lunch at St. Mary’s Parish Hall, Kottayam',
        x: 540,
        y: 1110,
        maxWidth: 900,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fecdd3',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer Message',
        defaultValue: 'Lovingly Arranged by Children & Grandchildren',
        x: 540,
        y: 1215,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
    ],
  },
  {
    id: 'ann-05-ivory-rose-wreath',
    name: 'Ivory & Rose Gold Floral Wreath Anniversary Card',
    category: 'anniversary',
    categoryLabel: 'Wedding Anniversary',
    badge: 'Center Floral Wreath',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#fff1f2', '#ffe4e6', '#fef3c7'],
    bgPattern: 'minimal-linen',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#be123c',
    secondaryAccent: '#b45309',
    decorMotif: 'floral-botanical-corners',
    photoSlots: [
      {
        id: 'wreath-couple',
        label: 'Couple Portrait (Center Wreath)',
        x: 290,
        y: 220,
        width: 500,
        height: 500,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#be123c',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Greeting Header',
        defaultValue: 'WARMEST ANNIVERSARY WISHES',
        x: 540,
        y: 130,
        maxWidth: 880,
        fontSize: 26,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#be123c',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'DEEPAK SHARMA  &  POOJA SHARMA',
        x: 540,
        y: 825,
        maxWidth: 900,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#881337',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Quote',
        defaultValue: '“May your love continue to grow brighter and stronger with every passing year.”',
        x: 540,
        y: 915,
        maxWidth: 840,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '600',
        color: '#475569',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date',
        defaultValue: 'HAPPY ANNIVERSARY · 15 NOVEMBER 2026',
        x: 540,
        y: 1030,
        maxWidth: 860,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#b45309',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Celebration Note',
        defaultValue: 'Cheers to a Lifetime of Happiness Together!',
        x: 540,
        y: 1120,
        maxWidth: 860,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#be123c',
        align: 'center',
      },
      {
        id: 'message',
        label: 'From Line',
        defaultValue: 'With Lots of Love: Sharma Family & Friends',
        x: 540,
        y: 1215,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#881337',
        align: 'center',
      },
    ],
  },
  {
    id: 'ann-06-family-4photo-tribute',
    name: 'Family Legacy 4-Photo Anniversary Tribute Poster',
    category: 'anniversary',
    categoryLabel: 'Wedding Anniversary',
    badge: '4 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#172554', '#1e3a8a', '#0f172a'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#93c5fd',
    decorMotif: 'golden-jubilee-crest',
    photoSlots: [
      {
        id: 'parents-main',
        label: 'Main Couple Photo (Top Center)',
        x: 340,
        y: 185,
        width: 400,
        height: 440,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'fam-1',
        label: 'Family Photo 1 (Bottom Left)',
        x: 90,
        y: 660,
        width: 280,
        height: 220,
        shape: 'rounded',
        frameStyle: 'silver-luxury',
        accentColor: '#93c5fd',
        defaultSampleIndex: 1,
      },
      {
        id: 'fam-2',
        label: 'Family Photo 2 (Bottom Center)',
        x: 400,
        y: 660,
        width: 280,
        height: 220,
        shape: 'rounded',
        frameStyle: 'silver-luxury',
        accentColor: '#93c5fd',
        defaultSampleIndex: 2,
      },
      {
        id: 'fam-3',
        label: 'Family Photo 3 (Bottom Right)',
        x: 710,
        y: 660,
        width: 280,
        height: 220,
        shape: 'rounded',
        frameStyle: 'silver-luxury',
        accentColor: '#93c5fd',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'HAPPY WEDDING ANNIVERSARY TO MOM & DAD',
        x: 540,
        y: 120,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Parents Names',
        defaultValue: 'SHRI RAMESH NAIK  &  SMT. GEETHA NAIK',
        x: 540,
        y: 960,
        maxWidth: 920,
        fontSize: 44,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Milestone',
        defaultValue: '30 YEARS OF LOVE & BLESSINGS · 25 NOV 2026',
        x: 540,
        y: 1045,
        maxWidth: 880,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Venue / Gathering',
        defaultValue: 'Family Get-Together at Hotel Ocean Pearl, Karwar',
        x: 540,
        y: 1125,
        maxWidth: 880,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#bfdbfe',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer Note',
        defaultValue: 'Thank You for Being Our Guiding Light — With Love, Your Children',
        x: 540,
        y: 1215,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORY 3: ENGAGEMENT TEMPLATES (6 Templates)
  // --------------------------------------------------------------------------
  {
    id: 'eng-01-royal-blue-ring-ceremony',
    name: 'Royal Blue & Gold Ring Ceremony Invitation',
    category: 'engagement',
    categoryLabel: 'Engagement',
    badge: 'Left Couple Photo + Right Text',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#0c1938', '#1e3a8a', '#090d16'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#7dd3fc',
    decorMotif: 'ring-ceremony-geometric',
    photoSlots: [
      {
        id: 'eng-couple',
        label: 'Couple Portrait (Left Arch)',
        x: 80,
        y: 250,
        width: 430,
        height: 760,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '💍 ENGAGEMENT & RING CEREMONY INVITATION 💍',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Invite Line',
        defaultValue: 'We cordially invite you to share in our joy at the Engagement Ceremony of',
        x: 545,
        y: 320,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#e0f2fe',
        align: 'left',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'ADITYA VERMA\n&\nSNEHA PATEL',
        x: 545,
        y: 470,
        maxWidth: 450,
        fontSize: 50,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'SUNDAY, 08 NOVEMBER 2026\nRing Exchange: 11:30 AM',
        x: 545,
        y: 720,
        maxWidth: 450,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Crystal Ballroom, Hotel Royal Orchid,\nIndiranagar, Bengaluru',
        x: 545,
        y: 870,
        maxWidth: 450,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'RSVP / Lunch Note',
        defaultValue: 'Followed by Lunch · RSVP: Verma & Patel Family (+91 98450 55667)',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#bae6fd',
        align: 'center',
      },
    ],
  },
  {
    id: 'eng-02-blush-pink-dual-circles',
    name: 'Blush Pink & Gold Dual Portrait Engagement Card',
    category: 'engagement',
    categoryLabel: 'Engagement',
    badge: '2 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#500724', '#831843', '#3b0764'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#fbcfe8',
    secondaryAccent: '#fde047',
    decorMotif: 'ring-ceremony-geometric',
    photoSlots: [
      {
        id: 'fiance-left',
        label: 'Groom-to-Be Photo (Left Circle)',
        x: 115,
        y: 255,
        width: 370,
        height: 370,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#fde047',
        defaultSampleIndex: 0,
      },
      {
        id: 'fiancee-right',
        label: 'Bride-to-Be Photo (Right Circle)',
        x: 595,
        y: 255,
        width: 370,
        height: 370,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#fde047',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'TWO HEARTS · ONE PROMISE · ENGAGEMENT CEREMONY',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'NIKHIL  &  SHREYA',
        x: 540,
        y: 745,
        maxWidth: 900,
        fontSize: 56,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Subtitle',
        defaultValue: 'Are getting engaged! Join us for an evening of rings, blessings & celebration',
        x: 540,
        y: 830,
        maxWidth: 860,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fbcfe8',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'SATURDAY, 21 NOVEMBER 2026 AT 6:00 PM',
        x: 540,
        y: 950,
        maxWidth: 880,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
        pillBgColor: 'rgba(253, 224, 71, 0.18)',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Rosewood Garden Banquet, Jayanagar, Bengaluru',
        x: 540,
        y: 1070,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'With Best Wishes From Both Families',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fbcfe8',
        align: 'center',
      },
    ],
  },
  {
    id: 'eng-03-maroon-velvet-sagai',
    name: 'Luxury Maroon Velvet Betrothal / Sagai Poster',
    category: 'engagement',
    categoryLabel: 'Engagement',
    badge: 'Center Ornate Arch',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#3f0616', '#6b0f2a', '#24020b'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#fecdd3',
    decorMotif: 'royal-mandala-arch',
    photoSlots: [
      {
        id: 'sagai-couple',
        label: 'Couple Photo (Center Arch)',
        x: 310,
        y: 205,
        width: 460,
        height: 550,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'AUSPICIOUS BETROTHAL & SAGAI CEREMONY',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'HARSHAVARDHAN  &  NANDINI',
        x: 540,
        y: 845,
        maxWidth: 920,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'FRIDAY, 27 NOVEMBER 2026 · 10:45 AM',
        x: 540,
        y: 945,
        maxWidth: 880,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Sri Krishna Palace Hall, Shivamogga, Karnataka',
        x: 540,
        y: 1050,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Your presence and blessings are cordially awaited',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fecdd3',
        align: 'center',
      },
    ],
  },
  {
    id: 'eng-04-modern-polaroid-duo',
    name: 'Modern Polaroid Duo Engagement Announcement',
    category: 'engagement',
    categoryLabel: 'Engagement',
    badge: '2 Polaroid Frames',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#18181b', '#27272a', '#09090b'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'double-line',
    primaryAccent: '#f59e0b',
    secondaryAccent: '#e4e4e7',
    decorMotif: 'ring-ceremony-geometric',
    photoSlots: [
      {
        id: 'pol-1',
        label: 'Couple Photo 1 (Left Polaroid)',
        x: 90,
        y: 235,
        width: 420,
        height: 510,
        shape: 'rect',
        frameStyle: 'polaroid-white',
        accentColor: '#ffffff',
        defaultSampleIndex: 0,
      },
      {
        id: 'pol-2',
        label: 'Couple Photo 2 (Right Polaroid)',
        x: 570,
        y: 235,
        width: 420,
        height: 510,
        shape: 'rect',
        frameStyle: 'polaroid-white',
        accentColor: '#ffffff',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Tag',
        defaultValue: 'SHE SAID YES! · ENGAGEMENT CELEBRATION',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'VARUN  &  TANVI',
        x: 540,
        y: 865,
        maxWidth: 900,
        fontSize: 58,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'SUNDAY, 06 DECEMBER 2026 AT 7:30 PM',
        x: 540,
        y: 970,
        maxWidth: 880,
        fontSize: 27,
        fontFamily: 'mono',
        fontWeight: '800',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'The Courtyard Pavilion, Residency Road, Bengaluru',
        x: 540,
        y: 1075,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#e4e4e7',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Join Us for Cocktails, Dinner & Ring Ceremony',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fbbf24',
        align: 'center',
      },
    ],
  },
  {
    id: 'eng-05-lavender-silver-right',
    name: 'Lavender & Silver Right-Photo Engagement Invite',
    category: 'engagement',
    categoryLabel: 'Engagement',
    badge: 'Right Couple Photo + Left Text',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#2e1065', '#4c1d95', '#1e1b4b'],
    bgPattern: 'damask',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#e9d5ff',
    secondaryAccent: '#fde047',
    decorMotif: 'floral-botanical-corners',
    photoSlots: [
      {
        id: 'right-oval',
        label: 'Couple Portrait (Right Oval)',
        x: 565,
        y: 260,
        width: 430,
        height: 750,
        shape: 'oval',
        frameStyle: 'silver-luxury',
        accentColor: '#e9d5ff',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'ENGAGEMENT CEREMONY INVITATION',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'PRANAV\n&\nAMRUTHA',
        x: 85,
        y: 350,
        maxWidth: 450,
        fontSize: 52,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'family_line',
        label: 'Invite Note',
        defaultValue: 'As we begin our journey together, we invite you to bless our Engagement Ceremony',
        x: 85,
        y: 610,
        maxWidth: 440,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#e9d5ff',
        align: 'left',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'SUNDAY, 13 DEC 2026\n11:00 AM Onwards',
        x: 85,
        y: 775,
        maxWidth: 440,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde047',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Lotus Grand Convention Hall,\nThrissur, Kerala',
        x: 85,
        y: 910,
        maxWidth: 440,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Warm Regards: Nair & Menon Families',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
    ],
  },
  {
    id: 'eng-06-emerald-gold-trio',
    name: 'Royal Emerald 3-Photo Ring Ceremony Poster',
    category: 'engagement',
    categoryLabel: 'Engagement',
    badge: '3 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#064e3b', '#065f46', '#022c22'],
    bgPattern: 'mandala',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#6ee7b7',
    decorMotif: 'ring-ceremony-geometric',
    photoSlots: [
      {
        id: 'eng-trio-center',
        label: 'Couple Portrait (Center Octagon)',
        x: 330,
        y: 200,
        width: 420,
        height: 480,
        shape: 'octagon',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'eng-trio-left',
        label: 'Groom Portrait (Left Circle)',
        x: 75,
        y: 320,
        width: 225,
        height: 225,
        shape: 'circle',
        frameStyle: 'ornate-corner',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'eng-trio-right',
        label: 'Bride Portrait (Right Circle)',
        x: 780,
        y: 320,
        width: 225,
        height: 225,
        shape: 'circle',
        frameStyle: 'ornate-corner',
        accentColor: '#fbbf24',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'RING CEREMONY & ENGAGEMENT CELEBRATION',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Couple Names',
        defaultValue: 'ABHISHEK  &  PRIYANKA',
        x: 540,
        y: 785,
        maxWidth: 920,
        fontSize: 52,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'WEDNESDAY, 02 DECEMBER 2026 AT 12:15 PM',
        x: 540,
        y: 905,
        maxWidth: 880,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        pillBgColor: 'rgba(251, 191, 36, 0.2)',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Green Valley Resort & Convention Center, Hassan',
        x: 540,
        y: 1035,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'With Best Compliments From Both Families',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#a7f3d0',
        align: 'center',
      },
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORY 4: BIRTHDAY TEMPLATES (6 Templates)
  // --------------------------------------------------------------------------
  {
    id: 'bday-01-royal-first-birthday-trio',
    name: '1st Birthday Royal Prince / Princess 3-Photo Poster',
    category: 'birthday',
    categoryLabel: 'Birthday',
    badge: '3 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#1e1b4b', '#312e81', '#0f172a'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#38bdf8',
    decorMotif: 'birthday-confetti-crown',
    photoSlots: [
      {
        id: 'bday-main',
        label: 'Main Birthday Portrait (Center Arch)',
        x: 330,
        y: 205,
        width: 420,
        height: 490,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 2,
      },
      {
        id: 'bday-left',
        label: 'Left Photo Slot',
        x: 75,
        y: 300,
        width: 225,
        height: 300,
        shape: 'rounded',
        frameStyle: 'ornate-corner',
        accentColor: '#38bdf8',
        defaultSampleIndex: 1,
      },
      {
        id: 'bday-right',
        label: 'Right Photo Slot',
        x: 780,
        y: 300,
        width: 225,
        height: 300,
        shape: 'rounded',
        frameStyle: 'ornate-corner',
        accentColor: '#38bdf8',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Header',
        defaultValue: '👑 OUR LITTLE PRINCE IS TURNING ONE! 👑',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Birthday Star Name',
        defaultValue: 'HAPPY 1st BIRTHDAY VIVAAN!',
        x: 540,
        y: 790,
        maxWidth: 920,
        fontSize: 52,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Invitation Line',
        defaultValue: 'Join us for Cake Cutting, Fun Games & Dinner as we celebrate Vivaan’s 1st Birthday',
        x: 540,
        y: 875,
        maxWidth: 860,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#e0e7ff',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Party Date & Time',
        defaultValue: 'SUNDAY, 15 NOVEMBER 2026 AT 6:30 PM',
        x: 540,
        y: 980,
        maxWidth: 880,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        pillBgColor: 'rgba(56, 189, 248, 0.22)',
      },
      {
        id: 'venue',
        label: 'Party Venue',
        defaultValue: 'Rainbow Party Hall, Hotel Empire Grand, MG Road, Chikmagalur',
        x: 540,
        y: 1090,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Parents / Host Line',
        defaultValue: 'Warm Invite From: Rahul & Priya (Parents) · +91 98450 11223',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#bae6fd',
        align: 'center',
      },
    ],
  },
  {
    id: 'bday-02-black-gold-vip',
    name: 'Luxury Black & Gold VIP Milestone Birthday Poster',
    category: 'birthday',
    categoryLabel: 'Birthday',
    badge: 'Left Portrait + Right VIP Text',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#09090b', '#18181b', '#000000'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#fde68a',
    decorMotif: 'birthday-confetti-crown',
    photoSlots: [
      {
        id: 'vip-portrait',
        label: 'Honoree Portrait (Left Frame)',
        x: 80,
        y: 240,
        width: 430,
        height: 780,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Kicker',
        defaultValue: '✦ GRAND BIRTHDAY CELEBRATION ✦',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Honoree Name',
        defaultValue: 'HAPPY\nBIRTHDAY\nKIRAN RAJ',
        x: 545,
        y: 335,
        maxWidth: 455,
        fontSize: 56,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.15,
      },
      {
        id: 'family_line',
        label: 'Birthday Wish',
        defaultValue: 'Wishing you a year filled with grand success, good health, happiness, and prosperity!',
        x: 545,
        y: 625,
        maxWidth: 450,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '500',
        color: '#e4e4e7',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'datetime',
        label: 'Date & Celebration Time',
        defaultValue: '25 NOVEMBER 2026 · 7:30 PM ONWARDS',
        x: 545,
        y: 800,
        maxWidth: 450,
        fontSize: 25,
        fontFamily: 'mono',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Location / Venue',
        defaultValue: 'Grand Imperial Lounge, Brigade Road, Bengaluru',
        x: 545,
        y: 910,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Wishes From',
        defaultValue: 'Best Wishes From: Friends, Youth Club & Family Members',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fbbf24',
        align: 'center',
        pillBgColor: 'rgba(251, 191, 36, 0.16)',
      },
    ],
  },
  {
    id: 'bday-03-kids-carnival-collage',
    name: 'Kids Festive Carnival 3-Photo Birthday Invitation',
    category: 'birthday',
    categoryLabel: 'Birthday',
    badge: '3 Photo Circles',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#0284c7', '#0369a1', '#1e3a8a'],
    bgPattern: 'rays',
    outerBorderStyle: 'festive-toran',
    primaryAccent: '#fde047',
    secondaryAccent: '#f472b6',
    decorMotif: 'kids-carnival-bunting',
    photoSlots: [
      {
        id: 'kid-center',
        label: 'Birthday Kid Main Photo (Center)',
        x: 340,
        y: 205,
        width: 400,
        height: 400,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#fde047',
        defaultSampleIndex: 1,
      },
      {
        id: 'kid-left',
        label: 'Fun Photo 1 (Left Circle)',
        x: 75,
        y: 350,
        width: 230,
        height: 230,
        shape: 'circle',
        frameStyle: 'polaroid-white',
        accentColor: '#ffffff',
        defaultSampleIndex: 0,
      },
      {
        id: 'kid-right',
        label: 'Fun Photo 2 (Right Circle)',
        x: 775,
        y: 350,
        width: 230,
        height: 230,
        shape: 'circle',
        frameStyle: 'polaroid-white',
        accentColor: '#ffffff',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Line',
        defaultValue: '🎈 YOU ARE INVITED TO A FUN BIRTHDAY BASH! 🎈',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Child Name & Age',
        defaultValue: 'AARADHAYA IS TURNING 5!',
        x: 540,
        y: 725,
        maxWidth: 920,
        fontSize: 54,
        fontFamily: 'sans',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Invite Text',
        defaultValue: 'Come join us for Magic Show, Cake Cutting, Music & Lots of Fun!',
        x: 540,
        y: 815,
        maxWidth: 860,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#e0f2fe',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'SATURDAY, 28 NOVEMBER 2026 AT 5:30 PM',
        x: 540,
        y: 935,
        maxWidth: 880,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
        pillBgColor: 'rgba(15, 23, 42, 0.45)',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Fun World Banquet Hall, KMS Layout, Shivamogga',
        x: 540,
        y: 1060,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'message',
        label: 'RSVP',
        defaultValue: 'Waiting to Welcome You: Sandeep & Anjali',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
    ],
  },
  {
    id: 'bday-04-rose-gold-queen',
    name: 'Rose Gold & Floral Queen Dual-Photo Birthday Card',
    category: 'birthday',
    categoryLabel: 'Birthday',
    badge: '2 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#831843', '#9d174d', '#500724'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#fbcfe8',
    secondaryAccent: '#fde68a',
    decorMotif: 'birthday-confetti-crown',
    photoSlots: [
      {
        id: 'queen-main',
        label: 'Main Portrait (Left Arch)',
        x: 90,
        y: 235,
        width: 440,
        height: 560,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fde68a',
        defaultSampleIndex: 1,
      },
      {
        id: 'queen-secondary',
        label: 'Secondary Photo (Right Circle)',
        x: 590,
        y: 270,
        width: 380,
        height: 380,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#fbcfe8',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '✨ SPARKLE & SHINE · HAPPY BIRTHDAY ✨',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Name',
        defaultValue: 'HAPPY BIRTHDAY DIVYA!',
        x: 540,
        y: 895,
        maxWidth: 900,
        fontSize: 54,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Wish Line',
        defaultValue: 'May your special day be as radiant, graceful, and wonderful as you are!',
        x: 540,
        y: 980,
        maxWidth: 860,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fce7f3',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date',
        defaultValue: 'CELEBRATING ON 19 NOVEMBER 2026',
        x: 540,
        y: 1085,
        maxWidth: 880,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'With Lots of Love & Hugs From Family & Best Friends',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fbcfe8',
        align: 'center',
      },
    ],
  },
  {
    id: 'bday-05-60th-landmark-tribute',
    name: '60th Shashtiabdhapoorthi / Landmark Birthday Poster',
    category: 'birthday',
    categoryLabel: 'Birthday',
    badge: 'Center Traditional Arch',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#451a03', '#78350f', '#290f02'],
    bgPattern: 'mandala',
    outerBorderStyle: 'temple-border',
    primaryAccent: '#facc15',
    secondaryAccent: '#fed7aa',
    decorMotif: 'temple-kalash-gold',
    photoSlots: [
      {
        id: 'elder-portrait',
        label: 'Honoree Portrait (Center Arch)',
        x: 310,
        y: 205,
        width: 460,
        height: 550,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#facc15',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '60th BIRTHDAY & SHASHTIABDHAPOORTHI CELEBRATION',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Honoree Name',
        defaultValue: 'SHRI NARAYANA MURTHY',
        x: 540,
        y: 845,
        maxWidth: 920,
        fontSize: 50,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#facc15',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Tribute Line',
        defaultValue: 'Celebrating 60 glorious years of wisdom, kindness, and devotion to family',
        x: 540,
        y: 925,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#ffedd5',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Date & Time',
        defaultValue: 'SUNDAY, 22 NOVEMBER 2026 · 10:30 AM ONWARDS',
        x: 540,
        y: 1020,
        maxWidth: 880,
        fontSize: 27,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Venue',
        defaultValue: 'Sri Shankara Krupa Hall, Malleshwaram, Bengaluru',
        x: 540,
        y: 1110,
        maxWidth: 880,
        fontSize: 23,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Cordially Invited by Wife, Children & Grandchildren',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fed7aa',
        align: 'center',
      },
    ],
  },
  {
    id: 'bday-06-right-portrait-banner',
    name: 'Royal Cyan & Gold Right-Portrait Birthday Banner',
    category: 'birthday',
    categoryLabel: 'Birthday',
    badge: 'Right Portrait + Left Wishes',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#083344', '#155e75', '#0f172a'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#38bdf8',
    secondaryAccent: '#fbbf24',
    decorMotif: 'birthday-confetti-crown',
    photoSlots: [
      {
        id: 'right-bday-photo',
        label: 'Birthday Portrait (Right Frame)',
        x: 565,
        y: 250,
        width: 435,
        height: 760,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Banner',
        defaultValue: 'MANY MORE HAPPY RETURNS OF THE DAY',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#38bdf8',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Birthday Person Name',
        defaultValue: 'HAPPY\nBIRTHDAY\nCHANDRU',
        x: 80,
        y: 340,
        maxWidth: 455,
        fontSize: 54,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.15,
      },
      {
        id: 'family_line',
        label: 'Message',
        defaultValue: 'May all your dreams turn into reality and may your journey ahead be blessed with victory!',
        x: 80,
        y: 620,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '500',
        color: '#e0f2fe',
        align: 'left',
      },
      {
        id: 'datetime',
        label: 'Date',
        defaultValue: '30 OCTOBER 2026',
        x: 80,
        y: 800,
        maxWidth: 450,
        fontSize: 30,
        fontFamily: 'mono',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Affiliation / Title',
        defaultValue: 'Founder & Youth Leader · Malnadu Friends Circle',
        x: 80,
        y: 900,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Heartfelt Birthday Wishes From Team MALNADU MEDIA',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#38bdf8',
        align: 'center',
      },
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORY 5: MEMORIAL / CONDOLENCE TEMPLATES (6 Templates)
  // --------------------------------------------------------------------------
  {
    id: 'mem-01-ivory-shraddhanjali-garland',
    name: 'Dignified Ivory & Gold Shraddhanjali / Tribute Poster',
    category: 'memorial',
    categoryLabel: 'Memorial / Condolence',
    badge: 'Floral Garland Frame',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#fffbeb', '#fef3c7', '#f5f5f4'],
    bgPattern: 'minimal-linen',
    outerBorderStyle: 'dignified-frame',
    primaryAccent: '#b45309',
    secondaryAccent: '#78350f',
    decorMotif: 'memorial-lotus-diya',
    photoSlots: [
      {
        id: 'departed-portrait',
        label: 'Portrait Photo (Center Oval with Garland)',
        x: 330,
        y: 205,
        width: 420,
        height: 500,
        shape: 'oval',
        frameStyle: 'garland-tribute',
        accentColor: '#d97706',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Condolence Header',
        defaultValue: '💐 IN LOVING MEMORY · HEARTFELT SHRADDHANJALI 💐',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#78350f',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Full Name of the Departed',
        defaultValue: 'LATE SHRI VISHWANATH GOWDA',
        x: 540,
        y: 795,
        maxWidth: 920,
        fontSize: 46,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#451a03',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Birth & Passing Dates',
        defaultValue: 'Sunrise: 14 May 1948   —   Sunset: 28 October 2026',
        x: 540,
        y: 865,
        maxWidth: 880,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#b45309',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Tribute Quote / Prayer',
        defaultValue: '“A life of kindness, integrity, and love that will forever remain in our hearts. Om Shanti.”',
        x: 540,
        y: 950,
        maxWidth: 860,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '600',
        color: '#57534e',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Prayer Meeting / Ceremony Details',
        defaultValue: 'Vaikunta Samaradhane / Prayer Meeting: Sunday, 08 Nov 2026 at 11:30 AM\nVenue: Community Bhavan, Mudigere Road, Chikmagalur',
        x: 540,
        y: 1065,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#292524',
        align: 'center',
        lineHeight: 1.4,
      },
      {
        id: 'message',
        label: 'Bereaved Family Line',
        defaultValue: 'Deeply Mourned By: Sorrows & Bereaved Gowda Family Members',
        x: 540,
        y: 1215,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#78350f',
        align: 'center',
      },
    ],
  },
  {
    id: 'mem-02-maroon-left-portrait-condolence',
    name: 'Traditional Maroon & Gold Left-Portrait Memorial Poster',
    category: 'memorial',
    categoryLabel: 'Memorial / Condolence',
    badge: 'Left Portrait + Right Tribute',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#3b0a0a', '#5c1111', '#240505'],
    bgPattern: 'velvet-vignette',
    outerBorderStyle: 'dignified-frame',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#fde68a',
    decorMotif: 'memorial-garland-pillar',
    photoSlots: [
      {
        id: 'left-mem-photo',
        label: 'Portrait Photo (Left Arch with Garland)',
        x: 80,
        y: 255,
        width: 425,
        height: 740,
        shape: 'arch',
        frameStyle: 'garland-tribute',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '🕯️BHAVAPOORNA SHRADDHANJALI · REST IN PEACE 🕯️',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Name of Departed Soul',
        defaultValue: 'LATE SMT.\nSHANTHAMMA\nRAO',
        x: 545,
        y: 325,
        maxWidth: 455,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'datetime',
        label: 'Lifespan Dates',
        defaultValue: '1952 — 2026 (Aged 74 Years)',
        x: 545,
        y: 555,
        maxWidth: 450,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'family_line',
        label: 'Remembrance Message',
        defaultValue: 'With profound grief, we inform the sad demise of our beloved mother. May the Almighty grant eternal peace to the departed soul.',
        x: 545,
        y: 645,
        maxWidth: 450,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fef3c7',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'venue',
        label: 'Ceremony & Residence Address',
        defaultValue: 'Kailasa Samaradhane: 10 Nov 2026 at 12:00 PM\nAt Residence: "Sri Nilaya", Vidyanagar, Hassan',
        x: 545,
        y: 855,
        maxWidth: 450,
        fontSize: 21,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Mourned By',
        defaultValue: 'In Grief: Children, Grandchildren & Relatives',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fbbf24',
        align: 'center',
      },
    ],
  },
  {
    id: 'mem-03-peaceful-white-lotus',
    name: 'Peaceful White Lotus & Diya Condolence Card',
    category: 'memorial',
    categoryLabel: 'Memorial / Condolence',
    badge: 'Serene White & Gold',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#f8fafc', '#f1f5f9', '#e2e8f0'],
    bgPattern: 'minimal-linen',
    outerBorderStyle: 'dignified-frame',
    primaryAccent: '#475569',
    secondaryAccent: '#b45309',
    decorMotif: 'memorial-lotus-diya',
    photoSlots: [
      {
        id: 'lotus-portrait',
        label: 'Portrait Photo (Center Circle)',
        x: 330,
        y: 210,
        width: 420,
        height: 420,
        shape: 'circle',
        frameStyle: 'garland-tribute',
        accentColor: '#b45309',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'PRAYER MEETING & REMEMBRANCE',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#334155',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Name',
        defaultValue: 'IN LOVING MEMORY OF SHRI MOHAN DAS',
        x: 540,
        y: 735,
        maxWidth: 920,
        fontSize: 44,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#0f172a',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Dates',
        defaultValue: '10 AUGUST 1950  —  29 OCTOBER 2026',
        x: 540,
        y: 810,
        maxWidth: 880,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#b45309',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Quote',
        defaultValue: '“Those we love never truly leave us; they live on in the kindness they shared.”',
        x: 540,
        y: 905,
        maxWidth: 840,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#475569',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Prayer Meeting Venue & Time',
        defaultValue: 'Chautha & Prayer Meeting: Friday, 06 Nov 2026 (4:00 PM to 5:30 PM)\nAt Arya Samaj Mandir Hall, Gandhinagar, Mangaluru',
        x: 540,
        y: 1035,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#1e293b',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Family Footer',
        defaultValue: 'Fondly Remembered By: Das Family & Relatives',
        x: 540,
        y: 1215,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#334155',
        align: 'center',
      },
    ],
  },
  {
    id: 'mem-04-christian-funeral-service',
    name: 'Dignified Christian Funeral & Memorial Service Poster',
    category: 'memorial',
    categoryLabel: 'Memorial / Condolence',
    badge: 'Left Portrait + Cross & Dove',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#0f172a', '#1e293b', '#090d16'],
    bgPattern: 'velvet-vignette',
    outerBorderStyle: 'dignified-frame',
    primaryAccent: '#e2e8f0',
    secondaryAccent: '#fbbf24',
    decorMotif: 'memorial-dove-cross',
    photoSlots: [
      {
        id: 'christian-mem-photo',
        label: 'Portrait Photo (Left Arch)',
        x: 80,
        y: 255,
        width: 425,
        height: 740,
        shape: 'arch',
        frameStyle: 'silver-luxury',
        accentColor: '#e2e8f0',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Scripture Header',
        defaultValue: '✝️ “I AM THE RESURRECTION AND THE LIFE” — JOHN 11:25 ✝️',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Departed Name',
        defaultValue: 'CALLED TO ETERNAL REST\nMR. GEORGE VARGHESE',
        x: 545,
        y: 330,
        maxWidth: 455,
        fontSize: 42,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.25,
      },
      {
        id: 'datetime',
        label: 'Birth & Passing Dates',
        defaultValue: 'Born: 12-03-1946  ·  Entered Glory: 29-10-2026',
        x: 545,
        y: 520,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fbbf24',
        align: 'left',
      },
      {
        id: 'family_line',
        label: 'Tribute Verse',
        defaultValue: '“I have fought the good fight, I have finished the race, I have kept the faith.” (2 Timothy 4:7)',
        x: 545,
        y: 620,
        maxWidth: 450,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#cbd5e1',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'venue',
        label: 'Funeral Service Schedule',
        defaultValue: 'Funeral Service: Saturday, 31 Oct 2026 at 3:00 PM\nAt St. Thomas Orthodox Syrian Church, Kottayam',
        x: 545,
        y: 830,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#f8fafc',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Live Stream / Family Info',
        defaultValue: 'Live Broadcast by MALNADU MEDIA · Sorrowing Varghese Family',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 20,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'center',
      },
    ],
  },
  {
    id: 'mem-05-first-anniversary-remembrance',
    name: '1st Death Anniversary (Varshik Shraddha) 2-Photo Tribute',
    category: 'memorial',
    categoryLabel: 'Memorial / Condolence',
    badge: '2 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#292524', '#44403c', '#1c1917'],
    bgPattern: 'velvet-vignette',
    outerBorderStyle: 'dignified-frame',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#e7e5e4',
    decorMotif: 'memorial-lotus-diya',
    photoSlots: [
      {
        id: 'mem-main',
        label: 'Main Portrait (Left Oval)',
        x: 110,
        y: 240,
        width: 390,
        height: 480,
        shape: 'oval',
        frameStyle: 'garland-tribute',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
      {
        id: 'mem-secondary',
        label: 'Cherished Memory Photo (Right Rounded)',
        x: 560,
        y: 265,
        width: 410,
        height: 430,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#d6d3d1',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'FIRST REMEMBRANCE DAY · VARSHIK SHRADDHA',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Name',
        defaultValue: 'FONDLY REMEMBERING LATE SHRI SUBRAMANYA BHAT',
        x: 540,
        y: 810,
        maxWidth: 920,
        fontSize: 40,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Tribute Note',
        defaultValue: 'A year has passed since you left us, yet your teachings and blessings guide us every single day.',
        x: 540,
        y: 895,
        maxWidth: 860,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#f5f5f4',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Ceremony Date',
        defaultValue: '1st Varshik Shraddha Pooja: Sunday, 15 November 2026 at 11:00 AM',
        x: 540,
        y: 1015,
        maxWidth: 880,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Location',
        defaultValue: 'At Our Residence: Sringeri Road, Koppa, Chikmagalur Dist.',
        x: 540,
        y: 1105,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Family Footer',
        defaultValue: 'Ever Remembered By: Bhat Family & Well-Wishers',
        x: 540,
        y: 1215,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#d6d3d1',
        align: 'center',
      },
    ],
  },
  {
    id: 'mem-06-black-gold-in-loving-memory',
    name: 'Classic Black & Gold In Loving Memory Tribute Poster',
    category: 'memorial',
    categoryLabel: 'Memorial / Condolence',
    badge: 'Right Portrait + Left Biography',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#09090b', '#18181b', '#000000'],
    bgPattern: 'velvet-vignette',
    outerBorderStyle: 'dignified-frame',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#d4d4d8',
    decorMotif: 'memorial-garland-pillar',
    photoSlots: [
      {
        id: 'right-mem-portrait',
        label: 'Portrait Photo (Right Oval)',
        x: 570,
        y: 255,
        width: 425,
        height: 730,
        shape: 'oval',
        frameStyle: 'garland-tribute',
        accentColor: '#fbbf24',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: 'IN LOVING MEMORY · FOREVER IN OUR HEARTS',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fbbf24',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Departed Name',
        defaultValue: 'LATE DR.\nK. S. HEGDE',
        x: 85,
        y: 350,
        maxWidth: 450,
        fontSize: 52,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'datetime',
        label: 'Dates',
        defaultValue: '1945 — 2026',
        x: 85,
        y: 530,
        maxWidth: 450,
        fontSize: 30,
        fontFamily: 'mono',
        fontWeight: '800',
        color: '#fbbf24',
        align: 'left',
      },
      {
        id: 'family_line',
        label: 'Tribute Quote',
        defaultValue: 'A visionary educator and compassionate soul whose legacy of service will inspire generations.',
        x: 85,
        y: 625,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#d4d4d8',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'venue',
        label: 'Condolence Meeting',
        defaultValue: 'Condolence Meeting: Sunday, 15 Nov 2026 at 10:30 AM\nTown Hall Auditorium, Udupi',
        x: 85,
        y: 845,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Humble Tribute From: Family, Students & Admirers',
        x: 540,
        y: 1215,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fbbf24',
        align: 'center',
      },
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORY 6: FESTIVAL GREETING TEMPLATES (6 Templates)
  // --------------------------------------------------------------------------
  {
    id: 'fest-01-diwali-royal-greeting',
    name: 'Grand Diwali Festival of Lights Studio Greeting Poster',
    category: 'festival',
    categoryLabel: 'Festival Greeting',
    badge: 'Left Wishes + Right Sender Photo',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#451a03', '#7c2d12', '#2a0800'],
    bgPattern: 'mandala',
    outerBorderStyle: 'festive-toran',
    primaryAccent: '#facc15',
    secondaryAccent: '#fb923c',
    decorMotif: 'festival-diwali-diyas',
    photoSlots: [
      {
        id: 'sender-photo',
        label: 'Your Portrait / Family Photo (Right Arch)',
        x: 575,
        y: 265,
        width: 420,
        height: 730,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#facc15',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Festival Header',
        defaultValue: '🪔 SHUBH DEEPAVALI · FESTIVAL OF LIGHTS 🪔',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 26,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Main Greeting Title',
        defaultValue: 'HAPPY\nDIWALI\n& PROSPEROUS NEW YEAR',
        x: 85,
        y: 335,
        maxWidth: 460,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#facc15',
        align: 'left',
        lineHeight: 1.2,
      },
      {
        id: 'family_line',
        label: 'Festival Wish Message',
        defaultValue: 'May the divine light of Deepavali illuminate your home with peace, prosperity, good health, and endless joy!',
        x: 85,
        y: 615,
        maxWidth: 455,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#ffedd5',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'datetime',
        label: 'Sender Name & Designation',
        defaultValue: 'WARM REGARDS:\nSHRIYANSH SINGH RAJPOOT',
        x: 85,
        y: 830,
        maxWidth: 455,
        fontSize: 26,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Studio / Organization Name',
        defaultValue: 'MALNADU MEDIA SOLUTIONS · Chikmagalur',
        x: 85,
        y: 940,
        maxWidth: 455,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#fde047',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer Contact',
        defaultValue: 'Wishing You & Your Family a Blessed Deepavali!',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#facc15',
        align: 'center',
        pillBgColor: 'rgba(250, 204, 21, 0.16)',
      },
    ],
  },
  {
    id: 'fest-02-eid-mubarak-emerald',
    name: 'Royal Emerald & Gold Eid Mubarak Greeting Poster',
    category: 'festival',
    categoryLabel: 'Festival Greeting',
    badge: 'Left Portrait + Right Eid Wishes',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#022c22', '#064e3b', '#042f2e'],
    bgPattern: 'damask',
    outerBorderStyle: 'royal-gold',
    primaryAccent: '#fbbf24',
    secondaryAccent: '#a7f3d0',
    decorMotif: 'festival-eid-crescent',
    photoSlots: [
      {
        id: 'eid-portrait',
        label: 'Sender / Family Photo (Left Arch)',
        x: 80,
        y: 265,
        width: 425,
        height: 730,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#fbbf24',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '🌙 EID MUBARAK TO YOU AND YOUR FAMILY 🌙',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde68a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Main Title',
        defaultValue: 'EID\nMUBARAK',
        x: 545,
        y: 350,
        maxWidth: 455,
        fontSize: 64,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#fbbf24',
        align: 'left',
        lineHeight: 1.15,
      },
      {
        id: 'family_line',
        label: 'Blessing Message',
        defaultValue: 'May Almighty Allah accept your prayers and bless your home with peace, happiness, and togetherness on this joyous occasion of Eid.',
        x: 545,
        y: 575,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#d1fae5',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'datetime',
        label: 'Sender Name',
        defaultValue: 'HEARTFELT WISHES FROM:\nIMRAN KHAN & FAMILY',
        x: 545,
        y: 815,
        maxWidth: 450,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Location / Business',
        defaultValue: 'Royal Traders & Associates, Mangaluru',
        x: 545,
        y: 925,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde68a',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Peace, Love & Blessings Always!',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#a7f3d0',
        align: 'center',
      },
    ],
  },
  {
    id: 'fest-03-christmas-new-year-duo',
    name: 'Merry Christmas & Happy New Year 2-Photo Family Card',
    category: 'festival',
    categoryLabel: 'Festival Greeting',
    badge: '2 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#450a0a', '#7f1d1d', '#052e16'],
    bgPattern: 'bokeh',
    outerBorderStyle: 'floral-frame',
    primaryAccent: '#fde047',
    secondaryAccent: '#bbf7d0',
    decorMotif: 'festival-christmas-wreath',
    photoSlots: [
      {
        id: 'xmas-left',
        label: 'Family Photo 1 (Left Rounded)',
        x: 95,
        y: 250,
        width: 415,
        height: 490,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fde047',
        defaultSampleIndex: 1,
      },
      {
        id: 'xmas-right',
        label: 'Family Photo 2 (Right Rounded)',
        x: 570,
        y: 250,
        width: 415,
        height: 490,
        shape: 'rounded',
        frameStyle: 'gold-double',
        accentColor: '#fde047',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Top Banner',
        defaultValue: '🎄 SEASON’S GREETINGS & FESTIVE JOY 🎄',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Holiday Title',
        defaultValue: 'MERRY CHRISTMAS & HAPPY NEW YEAR 2027',
        x: 540,
        y: 840,
        maxWidth: 920,
        fontSize: 44,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Message',
        defaultValue: 'May the miracle of Christmas fill your heart with warmth, love, and peace throughout the coming New Year!',
        x: 540,
        y: 930,
        maxWidth: 860,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Sender Family Name',
        defaultValue: 'WITH LOVE FROM: D’SOUZA FAMILY',
        x: 540,
        y: 1055,
        maxWidth: 880,
        fontSize: 28,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#bbf7d0',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Joy to the World · Peace on Earth',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#fde047',
        align: 'center',
      },
    ],
  },
  {
    id: 'fest-04-onam-pongal-kasavu',
    name: 'Traditional Kasavu Gold Onam / Pongal / Sankranti Poster',
    category: 'festival',
    categoryLabel: 'Festival Greeting',
    badge: 'Center Circle + Traditional Border',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#fefce8', '#fef3c7', '#fffbeb'],
    bgPattern: 'minimal-linen',
    outerBorderStyle: 'temple-border',
    primaryAccent: '#b45309',
    secondaryAccent: '#15803d',
    decorMotif: 'festival-traditional-toran',
    photoSlots: [
      {
        id: 'fest-center-photo',
        label: 'Your Portrait / Family Photo (Center Circle)',
        x: 315,
        y: 215,
        width: 450,
        height: 450,
        shape: 'circle',
        frameStyle: 'floral-wreath',
        accentColor: '#b45309',
        defaultSampleIndex: 0,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '🌾 HARVEST FESTIVAL GREETINGS · AUSPICIOUS WISHES 🌾',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#15803d',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Festival Title',
        defaultValue: 'HAPPY ONAM & MAKAR SANKRANTI!',
        x: 540,
        y: 775,
        maxWidth: 920,
        fontSize: 48,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#78350f',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Wishing Text',
        defaultValue: 'May this auspicious harvest festival bring abundant prosperity, harmony, and sweet moments to your family!',
        x: 540,
        y: 865,
        maxWidth: 860,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '600',
        color: '#44403c',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Sender Name',
        defaultValue: 'BEST WISHES FROM: ARJUN NAIR & TEAM',
        x: 540,
        y: 995,
        maxWidth: 880,
        fontSize: 27,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#15803d',
        align: 'center',
      },
      {
        id: 'venue',
        label: 'Organization / Place',
        defaultValue: 'MALNADU MEDIA · Capturing | Creating | Connecting',
        x: 540,
        y: 1085,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '700',
        color: '#b45309',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Wishing You Health, Wealth & Happiness Always',
        x: 540,
        y: 1210,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#78350f',
        align: 'center',
      },
    ],
  },
  {
    id: 'fest-05-navratri-dussehra-toran',
    name: 'Festive Saffron & Gold Navratri / Dussehra Greeting',
    category: 'festival',
    categoryLabel: 'Festival Greeting',
    badge: 'Left Portrait + Right Wishes',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#7c2d12', '#9a3412', '#450a0a'],
    bgPattern: 'mandala',
    outerBorderStyle: 'festive-toran',
    primaryAccent: '#facc15',
    secondaryAccent: '#fed7aa',
    decorMotif: 'festival-traditional-toran',
    photoSlots: [
      {
        id: 'nav-photo',
        label: 'Presenter Portrait (Left Arch)',
        x: 80,
        y: 260,
        width: 425,
        height: 735,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#facc15',
        defaultSampleIndex: 1,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '🌺 SHUBH NAVRATRI & VIJAYADASHAMI GREETINGS 🌺',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 24,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Festival Title',
        defaultValue: 'HAPPY\nNAVRATRI &\nDASARA',
        x: 545,
        y: 340,
        maxWidth: 455,
        fontSize: 54,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#facc15',
        align: 'left',
        lineHeight: 1.18,
      },
      {
        id: 'family_line',
        label: 'Message',
        defaultValue: 'May Goddess Chamundeshwari bless you with strength, wisdom, victory, and boundless happiness on this auspicious Dasara!',
        x: 545,
        y: 625,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#ffedd5',
        align: 'left',
        lineHeight: 1.4,
      },
      {
        id: 'datetime',
        label: 'Sender Name',
        defaultValue: 'WITH BEST COMPLIMENTS:\nRAHUL SHETTY',
        x: 545,
        y: 840,
        maxWidth: 450,
        fontSize: 25,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'left',
      },
      {
        id: 'venue',
        label: 'Organization',
        defaultValue: 'Chikmagalur Cultural & Media Forum',
        x: 545,
        y: 945,
        maxWidth: 450,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde047',
        align: 'left',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Celebrating the Victory of Good Over Evil',
        x: 540,
        y: 1210,
        maxWidth: 900,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#facc15',
        align: 'center',
      },
    ],
  },
  {
    id: 'fest-06-ugadi-ganesh-dual-banner',
    name: 'Auspicious Ganesh Chaturthi / Ugadi Dual-Photo Poster',
    category: 'festival',
    categoryLabel: 'Festival Greeting',
    badge: '2 Photo Areas',
    canvasWidth: 1080,
    canvasHeight: 1350,
    bgColors: ['#581c87', '#7e22ce', '#3b0764'],
    bgPattern: 'mandala',
    outerBorderStyle: 'temple-border',
    primaryAccent: '#facc15',
    secondaryAccent: '#f3e8ff',
    decorMotif: 'festival-diwali-diyas',
    photoSlots: [
      {
        id: 'fest-duo-left',
        label: 'Photo 1 (Left Rounded)',
        x: 105,
        y: 250,
        width: 390,
        height: 460,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#facc15',
        defaultSampleIndex: 0,
      },
      {
        id: 'fest-duo-right',
        label: 'Photo 2 (Right Rounded)',
        x: 585,
        y: 250,
        width: 390,
        height: 460,
        shape: 'arch',
        frameStyle: 'gold-double',
        accentColor: '#facc15',
        defaultSampleIndex: 2,
      },
    ],
    textFields: [
      {
        id: 'auspicious',
        label: 'Header',
        defaultValue: '✨ AUSPICIOUS FESTIVAL GREETINGS & BLESSINGS ✨',
        x: 540,
        y: 125,
        maxWidth: 900,
        fontSize: 25,
        fontFamily: 'serif',
        fontWeight: '800',
        color: '#fef08a',
        align: 'center',
      },
      {
        id: 'bride_groom',
        label: 'Greeting Title',
        defaultValue: 'HAPPY GANESH CHATURTHI & UGADI',
        x: 540,
        y: 810,
        maxWidth: 920,
        fontSize: 46,
        fontFamily: 'serif',
        fontWeight: '900',
        color: '#facc15',
        align: 'center',
      },
      {
        id: 'family_line',
        label: 'Blessing Note',
        defaultValue: 'May Lord Vighnaharta remove all obstacles and shower your family with new beginnings, success, and joy!',
        x: 540,
        y: 895,
        maxWidth: 860,
        fontSize: 23,
        fontFamily: 'serif',
        fontWeight: '500',
        color: '#f3e8ff',
        align: 'center',
      },
      {
        id: 'datetime',
        label: 'Sender Name',
        defaultValue: 'HEARTFELT WISHES FROM: MALNADU MEDIA TEAM',
        x: 540,
        y: 1020,
        maxWidth: 880,
        fontSize: 27,
        fontFamily: 'sans',
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        pillBgColor: 'rgba(250, 204, 21, 0.2)',
      },
      {
        id: 'venue',
        label: 'Contact / Address',
        defaultValue: 'Main Road, Chikmagalur · www.studiopassport.online',
        x: 540,
        y: 1120,
        maxWidth: 880,
        fontSize: 22,
        fontFamily: 'sans',
        fontWeight: '600',
        color: '#fde047',
        align: 'center',
      },
      {
        id: 'message',
        label: 'Footer',
        defaultValue: 'Peace, Prosperity & Good Fortune to All',
        x: 540,
        y: 1215,
        maxWidth: 880,
        fontSize: 21,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#e9d5ff',
        align: 'center',
      },
    ],
  },
];

// ============================================================================
// CANVAS ORNAMENTAL & PROCEDURAL ARTWORK RENDERING HELPERS
// ============================================================================
function defineSlotClipPath(
  ctx: CanvasRenderingContext2D,
  slot: PhotoSlotSpec,
  insetPx = 0
) {
  const x = slot.x + insetPx;
  const y = slot.y + insetPx;
  const w = Math.max(20, slot.width - insetPx * 2);
  const h = Math.max(20, slot.height - insetPx * 2);

  ctx.beginPath();
  if (slot.shape === 'circle') {
    const r = Math.min(w, h) / 2;
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  } else if (slot.shape === 'oval') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (slot.shape === 'arch') {
    const archR = w / 2;
    const archCenterY = y + archR;
    ctx.moveTo(x, y + h - 18);
    ctx.lineTo(x, archCenterY);
    ctx.arc(x + w / 2, archCenterY, archR, Math.PI, 0, false);
    ctx.lineTo(x + w, y + h - 18);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 18, y + h);
    ctx.lineTo(x + 18, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 18);
    ctx.closePath();
  } else if (slot.shape === 'octagon') {
    const cut = Math.min(w, h) * 0.22;
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  } else if (slot.shape === 'rounded') {
    ctx.roundRect(x, y, w, h, 32);
  } else {
    ctx.roundRect(x, y, w, h, 8);
  }
}

function drawSlotDecorativeFrame(
  ctx: CanvasRenderingContext2D,
  slot: PhotoSlotSpec,
  isSelected: boolean
) {
  ctx.save();

  if (slot.frameStyle === 'polaroid-white') {
    // Draw Polaroid outer white frame border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    defineSlotClipPath(ctx, slot, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    defineSlotClipPath(ctx, slot, -7);
    ctx.stroke();
  } else if (slot.frameStyle === 'floral-wreath' || slot.frameStyle === 'garland-tribute') {
    // Outer golden ring
    ctx.strokeStyle = slot.accentColor;
    ctx.lineWidth = 6;
    defineSlotClipPath(ctx, slot, 0);
    ctx.stroke();

    ctx.lineWidth = 2;
    defineSlotClipPath(ctx, slot, -10);
    ctx.stroke();

    // Draw ornamental floral/marigold blossoms around perimeter
    const cx = slot.x + slot.width / 2;
    const cy = slot.y + slot.height / 2;
    const rx = slot.width / 2 + 6;
    const ry = slot.height / 2 + 6;
    const count = slot.frameStyle === 'garland-tribute' ? 28 : 20;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const fx = cx + Math.cos(angle) * rx;
      const fy = cy + Math.sin(angle) * ry;
      ctx.beginPath();
      ctx.fillStyle =
        slot.frameStyle === 'garland-tribute'
          ? i % 2 === 0
            ? '#f59e0b'
            : '#dc2626'
          : i % 2 === 0
          ? slot.accentColor
          : '#fda4af';
      ctx.arc(fx, fy, slot.frameStyle === 'garland-tribute' ? 9 : 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = '#fef08a';
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Royal Gold Double / Silver / Ornate Corner Frame
    ctx.strokeStyle = slot.accentColor;
    ctx.lineWidth = 6;
    defineSlotClipPath(ctx, slot, 0);
    ctx.stroke();

    ctx.strokeStyle = slot.accentColor;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    defineSlotClipPath(ctx, slot, -9);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Corner diamond studs
    const corners = [
      [slot.x, slot.y],
      [slot.x + slot.width, slot.y],
      [slot.x, slot.y + slot.height],
      [slot.x + slot.width, slot.y + slot.height],
    ];
    if (slot.shape === 'rect' || slot.shape === 'rounded') {
      corners.forEach(([kx, ky]) => {
        ctx.fillStyle = slot.accentColor;
        ctx.beginPath();
        ctx.arc(kx, ky, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // Highlight ring if user is actively editing this slot
  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    defineSlotClipPath(ctx, slot, -16);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawTemplateBackgroundAndBorders(
  ctx: CanvasRenderingContext2D,
  tpl: PosterTemplateSpec
) {
  const w = tpl.canvasWidth;
  const h = tpl.canvasHeight;

  // 1. Rich Multi-Stop Radial & Linear Gradient Background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, tpl.bgColors[0]);
  grad.addColorStop(0.52, tpl.bgColors[1]);
  grad.addColorStop(1, tpl.bgColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle ambient center glow
  const radGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.42, w * 0.7);
  radGrad.addColorStop(0, `${tpl.primaryAccent}22`);
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Procedural Pattern Layer (Mandala / Bokeh / Damask / Rays)
  ctx.save();
  if (tpl.bgPattern === 'mandala') {
    ctx.strokeStyle = tpl.primaryAccent;
    ctx.globalAlpha = 0.09;
    ctx.lineWidth = 1.5;
    const centers = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
      [w / 2, h / 2],
    ];
    centers.forEach(([cx, cy]) => {
      for (let r = 60; r <= 280; r += 36) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 45, cy + Math.sin(ang) * 45);
        ctx.lineTo(cx + Math.cos(ang) * 280, cy + Math.sin(ang) * 280);
        ctx.stroke();
      }
    });
  } else if (tpl.bgPattern === 'bokeh') {
    const seeds = [
      [140, 210, 46],
      [920, 190, 58],
      [860, 540, 38],
      [190, 880, 64],
      [910, 990, 52],
      [510, 170, 34],
      [340, 690, 44],
      [740, 790, 48],
    ];
    seeds.forEach(([bx, by, br], i) => {
      ctx.beginPath();
      ctx.fillStyle = i % 2 === 0 ? tpl.primaryAccent : tpl.secondaryAccent;
      ctx.globalAlpha = 0.08;
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (tpl.bgPattern === 'rays') {
    ctx.strokeStyle = tpl.primaryAccent;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = 18;
    for (let i = 0; i < 32; i++) {
      const ang = (i / 32) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.38);
      ctx.lineTo(w / 2 + Math.cos(ang) * 1200, h * 0.38 + Math.sin(ang) * 1200);
      ctx.stroke();
    }
  } else if (tpl.bgPattern === 'damask') {
    ctx.strokeStyle = tpl.primaryAccent;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = 1.5;
    for (let gx = 90; gx < w; gx += 120) {
      for (let gy = 90; gy < h; gy += 120) {
        ctx.beginPath();
        ctx.moveTo(gx, gy - 28);
        ctx.lineTo(gx + 28, gy);
        ctx.lineTo(gx, gy + 28);
        ctx.lineTo(gx - 28, gy);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // 3. Outer Ornamental Frame & Corner Flourishes
  ctx.save();
  const pad = 34;
  ctx.strokeStyle = tpl.primaryAccent;
  ctx.lineWidth = 4;
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(pad + 12, pad + 12, w - (pad + 12) * 2, h - (pad + 12) * 2);
  ctx.globalAlpha = 1;

  // Ornate Corner Bracket Flourishes
  const cornerCoords: Array<[number, number, number, number]> = [
    [pad, pad, 1, 1],
    [w - pad, pad, -1, 1],
    [pad, h - pad, 1, -1],
    [w - pad, h - pad, -1, -1],
  ];
  cornerCoords.forEach(([cx, cy, dx, dy]) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dx, dy);
    ctx.strokeStyle = tpl.primaryAccent;
    ctx.fillStyle = tpl.primaryAccent;
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.quadraticCurveTo(0, 0, 56, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(22, 22, 6, 0, Math.PI * 2);
    ctx.fill();

    if (tpl.outerBorderStyle === 'floral-frame') {
      ctx.fillStyle = tpl.secondaryAccent;
      ctx.beginPath();
      ctx.arc(38, 14, 7, 0, Math.PI * 2);
      ctx.arc(14, 38, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // Top Festive Toran / Marigold Garland if applicable
  if (tpl.outerBorderStyle === 'festive-toran' || tpl.decorMotif === 'festival-traditional-toran') {
    for (let tx = pad + 24; tx < w - pad - 20; tx += 36) {
      ctx.beginPath();
      ctx.fillStyle = (tx / 36) % 2 === 0 ? '#f59e0b' : '#ef4444';
      ctx.arc(tx, pad + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#fde047';
      ctx.arc(tx, pad + 18, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Category-specific subtle centerpiece emblem (top & bottom divider lines)
  ctx.strokeStyle = tpl.primaryAccent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 155);
  ctx.lineTo(w - 140, 155);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(160, h - 90);
  ctx.lineTo(w - 160, h - 90);
  ctx.stroke();

  ctx.restore();
}

function drawWrappedTextField(
  ctx: CanvasRenderingContext2D,
  field: TextFieldSpec,
  override?: TextFieldOverride
) {
  const rawText = override !== undefined ? override.text : field.defaultValue;
  if (!rawText || !rawText.trim()) return;

  const color = override?.color || field.color;
  const scale = (override?.fontScale || 100) / 100;
  const fontSize = Math.round(field.fontSize * scale);
  const lineHeight = fontSize * (field.lineHeight || 1.28);

  const fontStack =
    field.fontFamily === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : field.fontFamily === 'mono'
      ? 'ui-monospace, SFMono-Regular, monospace'
      : '"Plus Jakarta Sans", Inter, system-ui, sans-serif';

  ctx.save();
  ctx.font = `${field.fontWeight} ${fontSize}px ${fontStack}`;
  ctx.textAlign = field.align;
  ctx.textBaseline = 'top';

  const paragraphs = (field.uppercase ? rawText.toUpperCase() : rawText).split('\n');
  const lines: string[] = [];

  paragraphs.forEach((para) => {
    const words = para.split(' ');
    let currentLine = '';
    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > field.maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
  });

  const finalLines = field.maxLines ? lines.slice(0, field.maxLines) : lines;

  // Optional subtle banner backdrop behind key callout lines
  if (field.pillBgColor && finalLines.length > 0) {
    const totalH = finalLines.length * lineHeight + 20;
    const boxW = Math.min(field.maxWidth + 40, 940);
    const boxX =
      field.align === 'center'
        ? field.x - boxW / 2
        : field.align === 'right'
        ? field.x - boxW
        : field.x - 16;
    ctx.fillStyle = field.pillBgColor;
    ctx.strokeStyle = `${color}55`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, field.y - 12, boxW, totalH, 16);
    ctx.fill();
    ctx.stroke();
  }

  // Soft text drop shadow for legibility
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;

  finalLines.forEach((line, idx) => {
    ctx.fillText(line, field.x, field.y + idx * lineHeight);
  });

  ctx.restore();
}

// ============================================================================
// MAIN COMPONENT: PREMIUM POSTER TEMPLATE MAKER
// ============================================================================
interface PosterTemplateMakerProps {
  brandName?: string;
  onSendToStudio?: (dataUrl: string) => void;
  showToast: (msg: string) => void;
}

const CATEGORY_TABS: Array<{ id: PosterCategory; label: string; icon: string }> = [
  { id: 'all', label: 'All 36 Templates', icon: 'fa-border-all' },
  { id: 'wedding', label: 'Wedding Invitations (6)', icon: 'fa-ring' },
  { id: 'anniversary', label: 'Wedding Anniversary (6)', icon: 'fa-heart' },
  { id: 'engagement', label: 'Engagement (6)', icon: 'fa-gem' },
  { id: 'birthday', label: 'Birthday (6)', icon: 'fa-cake-candles' },
  { id: 'memorial', label: 'Memorial / Condolence (6)', icon: 'fa-dove' },
  { id: 'festival', label: 'Festival Greetings (6)', icon: 'fa-dharmachakra' },
];

export const PosterTemplateMaker: React.FC<PosterTemplateMakerProps> = ({
  onSendToStudio,
  showToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PosterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(POSTER_TEMPLATES[0].id);
  const [activeSlotId, setActiveSlotId] = useState<string>(POSTER_TEMPLATES[0].photoSlots[0].id);
  const [editorPanelTab, setEditorPanelTab] = useState<'photos' | 'text' | 'templates'>('photos');

  // Per-slot photo transforms keyed by slot.id
  const [slotTransforms, setSlotTransforms] = useState<Record<string, PhotoSlotTransform>>({});
  // Per-field text overrides keyed by `${templateId}::${fieldId}`
  const [textOverrides, setTextOverrides] = useState<Record<string, TextFieldOverride>>({});

  // Direct Canvas Dragging State
  const [isDraggingCanvasPhoto, setIsDraggingCanvasPhoto] = useState(false);
  const dragStartRef = useRef<{
    slotId: string;
    startClientX: number;
    startClientY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const slotFileInputRef = useRef<HTMLInputElement | null>(null);
  const samplePortraitsRef = useRef<HTMLImageElement[]>([]);

  const activeTemplate =
    POSTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || POSTER_TEMPLATES[0];

  const filteredTemplates = POSTER_TEMPLATES.filter((t) => {
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.categoryLabel.toLowerCase().includes(q) ||
      t.badge.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  // Preload 3 sample portraits on mount so templates look rich immediately and users can replace any photo
  useEffect(() => {
    const urls = [
      generateSamplePortraitDataUrl(0, false),
      generateSamplePortraitDataUrl(1, false),
      generateSamplePortraitDataUrl(2, false),
    ];
    const loaded: HTMLImageElement[] = [];
    let count = 0;
    urls.forEach((u, idx) => {
      const img = new Image();
      img.onload = () => {
        loaded[idx] = img;
        count++;
        if (count === urls.length) {
          samplePortraitsRef.current = loaded;
          initializeTemplateSlots(activeTemplate, loaded);
        }
      };
      img.src = u;
    });
  }, []);

  const initializeTemplateSlots = useCallback(
    (tpl: PosterTemplateSpec, samples = samplePortraitsRef.current) => {
      setSlotTransforms((prev) => {
        const next = { ...prev };
        tpl.photoSlots.forEach((slot) => {
          if (!next[slot.id]) {
            const sampleImg = samples[slot.defaultSampleIndex % Math.max(1, samples.length)] || null;
            next[slot.id] = {
              imageUrl: sampleImg ? sampleImg.src : '',
              imageElement: sampleImg,
              zoom: 105,
              panX: 0,
              panY: 0,
              rotation: 0,
              flipX: false,
              brightness: 100,
              contrast: 100,
              cropInset: 0,
            };
          }
        });
        return next;
      });
      if (tpl.photoSlots.length > 0) {
        setActiveSlotId(tpl.photoSlots[0].id);
      }
    },
    []
  );

  const handleSelectTemplate = (tpl: PosterTemplateSpec) => {
    setSelectedTemplateId(tpl.id);
    initializeTemplateSlots(tpl);
    showToast(`Loaded template: ${tpl.name}`);
  };

  // Render full poster to HTML5 Canvas
  const renderPosterCanvas = useCallback(
    (targetCanvas: HTMLCanvasElement, showSelectionHighlight = true) => {
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      targetCanvas.width = activeTemplate.canvasWidth;
      targetCanvas.height = activeTemplate.canvasHeight;

      // 1. Background, Ornamental Patterns & Borders
      drawTemplateBackgroundAndBorders(ctx, activeTemplate);

      // 2. Render Each Predefined Photo Slot with Clipping, Zoom, Pan, Crop & Rotation
      activeTemplate.photoSlots.forEach((slot) => {
        const transform = slotTransforms[slot.id];
        const cropInsetPx = Math.round(
          (Math.min(slot.width, slot.height) * (transform?.cropInset || 0)) / 200
        );

        // Slot dark backdrop before drawing photo
        ctx.save();
        defineSlotClipPath(ctx, slot, cropInsetPx);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.fill();

        if (transform?.imageElement) {
          ctx.clip();
          const img = transform.imageElement;
          const imgW = img.naturalWidth || img.width || 600;
          const imgH = img.naturalHeight || img.height || 800;

          // Cover-fit scaling inside slot
          const coverScale = Math.max(slot.width / imgW, slot.height / imgH);
          const finalScale = coverScale * ((transform.zoom || 100) / 100);

          const centerX = slot.x + slot.width / 2 + (transform.panX || 0);
          const centerY = slot.y + slot.height / 2 + (transform.panY || 0);

          ctx.translate(centerX, centerY);
          ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);
          ctx.scale(transform.flipX ? -finalScale : finalScale, finalScale);

          if (transform.brightness !== 100 || transform.contrast !== 100) {
            ctx.filter = `brightness(${transform.brightness}%) contrast(${transform.contrast}%)`;
          }

          ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
          ctx.filter = 'none';
        } else {
          // Placeholder prompt inside empty photo slot
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '700 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Click to Upload Photo', slot.x + slot.width / 2, slot.y + slot.height / 2);
        }
        ctx.restore();

        // 3. Draw Decorative Frame over the Photo Slot
        drawSlotDecorativeFrame(
          ctx,
          slot,
          showSelectionHighlight && activeSlotId === slot.id
        );
      });

      // 4. Render All Editable Non-Overlapping Text Layers
      activeTemplate.textFields.forEach((field) => {
        const key = `${activeTemplate.id}::${field.id}`;
        drawWrappedTextField(ctx, field, textOverrides[key]);
      });
    },
    [activeTemplate, slotTransforms, activeSlotId, textOverrides]
  );

  useEffect(() => {
    if (canvasRef.current) {
      renderPosterCanvas(canvasRef.current, true);
    }
  }, [renderPosterCanvas]);

  // Upload user photo into the currently active photo slot
  const handleSlotPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSlotId) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSlotTransforms((prev) => ({
        ...prev,
        [activeSlotId]: {
          ...(prev[activeSlotId] || {
            zoom: 100,
            panX: 0,
            panY: 0,
            rotation: 0,
            flipX: false,
            brightness: 100,
            contrast: 100,
            cropInset: 0,
          }),
          imageUrl: objectUrl,
          imageElement: img,
          zoom: 100,
          panX: 0,
          panY: 0,
          rotation: 0,
        },
      }));
      showToast('Photo placed into selected template frame! Drag on poster to reposition.');
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  const updateActiveSlotTransform = (patch: Partial<PhotoSlotTransform>) => {
    if (!activeSlotId) return;
    setSlotTransforms((prev) => {
      const current = prev[activeSlotId] || {
        imageUrl: '',
        imageElement: null,
        zoom: 100,
        panX: 0,
        panY: 0,
        rotation: 0,
        flipX: false,
        brightness: 100,
        contrast: 100,
        cropInset: 0,
      };
      return {
        ...prev,
        [activeSlotId]: { ...current, ...patch },
      };
    });
  };

  // Hit-test which photo slot was clicked/touched on the poster canvas
  const findSlotAtCanvasPoint = (canvasX: number, canvasY: number): PhotoSlotSpec | null => {
    for (let i = activeTemplate.photoSlots.length - 1; i >= 0; i--) {
      const s = activeTemplate.photoSlots[i];
      if (
        canvasX >= s.x &&
        canvasX <= s.x + s.width &&
        canvasY >= s.y &&
        canvasY <= s.y + s.height
      ) {
        return s;
      }
    }
    return null;
  };

  const handleCanvasPointerDown = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    const hitSlot = findSlotAtCanvasPoint(cx, cy);
    const targetSlotId = hitSlot ? hitSlot.id : activeSlotId;
    if (hitSlot) {
      setActiveSlotId(hitSlot.id);
    }

    const currentTransform = slotTransforms[targetSlotId];
    dragStartRef.current = {
      slotId: targetSlotId,
      startClientX: clientX,
      startClientY: clientY,
      initialPanX: currentTransform?.panX || 0,
      initialPanY: currentTransform?.panY || 0,
    };
    setIsDraggingCanvasPhoto(true);
  };

  const handleCanvasPointerMove = (clientX: number, clientY: number) => {
    if (!isDraggingCanvasPhoto || !dragStartRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / Math.max(1, rect.width);
    const scaleY = canvasRef.current.height / Math.max(1, rect.height);

    const dx = (clientX - dragStartRef.current.startClientX) * scaleX;
    const dy = (clientY - dragStartRef.current.startClientY) * scaleY;
    const slotId = dragStartRef.current.slotId;

    setSlotTransforms((prev) => {
      const cur = prev[slotId];
      if (!cur) return prev;
      return {
        ...prev,
        [slotId]: {
          ...cur,
          panX: Math.round(dragStartRef.current!.initialPanX + dx),
          panY: Math.round(dragStartRef.current!.initialPanY + dy),
        },
      };
    });
  };

  const handleCanvasPointerUp = () => {
    setIsDraggingCanvasPhoto(false);
    dragStartRef.current = null;
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 6 : -6;
    const current = slotTransforms[activeSlotId];
    const nextZoom = Math.max(50, Math.min(300, (current?.zoom || 100) + delta));
    updateActiveSlotTransform({ zoom: nextZoom });
  };

  const handleExportPoster = (format: 'png' | 'jpeg') => {
    const exportCanvas = document.createElement('canvas');
    renderPosterCanvas(exportCanvas, false); // Export without dashed selection ring
    const dataUrl = exportCanvas.toDataURL(
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      0.96
    );
    const link = document.createElement('a');
    link.download = `${activeTemplate.id}-poster.${format === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = dataUrl;
    link.click();
    showToast(`Downloaded High-Resolution ${format.toUpperCase()} Poster!`);
  };

  const handleSendPosterToStudio = () => {
    if (!onSendToStudio) return;
    const exportCanvas = document.createElement('canvas');
    renderPosterCanvas(exportCanvas, false);
    onSendToStudio(exportCanvas.toDataURL('image/png'));
  };

  const activeSlotSpec =
    activeTemplate.photoSlots.find((s) => s.id === activeSlotId) ||
    activeTemplate.photoSlots[0];
  const activeTransform = slotTransforms[activeSlotSpec?.id] || {
    imageUrl: '',
    imageElement: null,
    zoom: 100,
    panX: 0,
    panY: 0,
    rotation: 0,
    flipX: false,
    brightness: 100,
    contrast: 100,
    cropInset: 0,
  };

  return (
    <div className="space-y-5">
      {/* Top Studio Header Bar */}
      <div className="bg-[#070a14] text-white rounded-3xl p-4 sm:p-6 border border-cyan-500/30 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            <span>36 Ready-Made Studio Poster Templates · 100% Browser Canvas Editor</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white">
            Wedding, Anniversary, Engagement, Birthday, Memorial & Festival Poster Maker
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl">
            Select from 36 handcrafted templates with predefined photo frames. Upload your photos into each frame, drag directly on the poster to reposition, zoom/crop independently, edit all text fields, and download in HD PNG or JPG.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleExportPoster('png')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-extrabold shadow-md transition flex items-center gap-2"
          >
            <i className="fa-solid fa-download"></i>
            <span>Download HD PNG</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportPoster('jpeg')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md transition flex items-center gap-2"
          >
            <i className="fa-solid fa-file-image"></i>
            <span>Download HD JPG</span>
          </button>
          {onSendToStudio && (
            <button
              type="button"
              onClick={handleSendPosterToStudio}
              className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-print text-cyan-300"></i>
              <span>Send to Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <i className={`fa-solid ${cat.icon} text-[11px]`}></i>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 36 templates..."
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Horizontal Quick Template Selector Strip */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-1">
          {filteredTemplates.map((tpl) => {
            const isSelected = tpl.id === activeTemplate.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`group shrink-0 w-48 rounded-2xl p-2.5 border text-left transition flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-50/60 ring-2 ring-cyan-500/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className="h-20 w-full rounded-xl p-2 flex flex-col justify-between relative overflow-hidden border border-white/20"
                  style={{
                    background: `linear-gradient(135deg, ${tpl.bgColors[0]}, ${tpl.bgColors[1]}, ${tpl.bgColors[2]})`,
                  }}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold text-white/90">
                    <span>{tpl.categoryLabel}</span>
                    <span className="font-mono" style={{ color: tpl.primaryAccent }}>
                      {tpl.photoSlots.length} {tpl.photoSlots.length === 1 ? 'Photo' : 'Photos'}
                    </span>
                  </div>
                  <div
                    className="text-[11px] font-extrabold leading-tight line-clamp-2"
                    style={{ color: tpl.primaryAccent }}
                  >
                    {tpl.name}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-0.5">
                  <span className="truncate">{tpl.badge}</span>
                  {isSelected && (
                    <span className="text-cyan-700 font-extrabold shrink-0">Active</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Poster Editor Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (7 Cols): Interactive Poster Canvas Preview */}
        <div className="lg:col-span-7 bg-[#070a14] rounded-3xl border border-cyan-500/30 p-4 sm:p-6 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="text-xs font-extrabold text-white flex items-center gap-2">
                <span>{activeTemplate.name}</span>
                <span className="text-slate-400">·</span>
                <span className="text-cyan-300 font-mono text-[11px]">
                  {activeTemplate.canvasWidth}×{activeTemplate.canvasHeight} px
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tip: Click & drag directly on any photo frame below to reposition the photo, or scroll wheel to zoom in/out.
              </p>
            </div>

            {/* Active Photo Slot Switcher Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeTemplate.photoSlots.map((slot, idx) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    setActiveSlotId(slot.id);
                    setEditorPanelTab('photos');
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1.5 ${
                    activeSlotId === slot.id
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  <i className="fa-solid fa-camera text-[10px]"></i>
                  <span>Photo {idx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive HTML5 Canvas Container */}
          <div className="flex items-center justify-center bg-slate-950/90 rounded-2xl p-2 sm:p-4 border border-white/10 overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => handleCanvasPointerDown(e.clientX, e.clientY)}
              onMouseMove={(e) => handleCanvasPointerMove(e.clientX, e.clientY)}
              onMouseUp={handleCanvasPointerUp}
              onMouseLeave={handleCanvasPointerUp}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  handleCanvasPointerDown(e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 1) {
                  handleCanvasPointerMove(e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              onTouchEnd={handleCanvasPointerUp}
              onWheel={handleCanvasWheel}
              className="max-h-[680px] w-auto max-w-full rounded-xl shadow-2xl cursor-grab active:cursor-grabbing select-none touch-none"
            />
          </div>

          {/* Bottom Quick Upload & Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => slotFileInputRef.current?.click()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition flex items-center gap-2"
            >
              <i className="fa-solid fa-upload"></i>
              <span>Upload / Replace {activeSlotSpec?.label || 'Photo'}</span>
            </button>
            <input
              ref={slotFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSlotPhotoUpload}
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportPoster('png')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold transition"
              >
                Save PNG
              </button>
              <button
                type="button"
                onClick={() => handleExportPoster('jpeg')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition"
              >
                Save JPG
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Photo Placement Controls, Text Editor & Template Browser */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          {/* Segmented Control Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setEditorPanelTab('photos')}
              className={`min-h-[40px] rounded-xl transition flex items-center justify-center gap-1.5 ${
                editorPanelTab === 'photos'
                  ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-images"></i>
              <span>Photo Areas ({activeTemplate.photoSlots.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorPanelTab('text')}
              className={`min-h-[40px] rounded-xl transition flex items-center justify-center gap-1.5 ${
                editorPanelTab === 'text'
                  ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-font"></i>
              <span>Edit Text ({activeTemplate.textFields.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorPanelTab('templates')}
              className={`min-h-[40px] rounded-xl transition flex items-center justify-center gap-1.5 ${
                editorPanelTab === 'templates'
                  ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fa-solid fa-swatchbook"></i>
              <span>All 36 Designs</span>
            </button>
          </div>

          {/* =================================================================
              TAB 1: PHOTO PLACEMENT, DRAG, ZOOM & CROP CONTROLS
             ================================================================= */}
          {editorPanelTab === 'photos' && activeSlotSpec && (
            <div className="space-y-4">
              {/* Photo Slot Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800">
                  1. Select Predefined Photo Area to Edit
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {activeTemplate.photoSlots.map((slot, idx) => {
                    const isSelected = slot.id === activeSlotSpec.id;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => setActiveSlotId(slot.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-cyan-50/70 border-cyan-500'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#070a14] text-cyan-300 font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-slate-900 truncate">
                              {slot.label}
                            </div>
                            <div className="text-[10px] text-slate-500 capitalize">
                              Shape: {slot.shape} · Frame: {slot.frameStyle.replace('-', ' ')}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setActiveSlotId(slot.id);
                            slotFileInputRef.current?.click();
                          }}
                          className="min-h-[34px] px-3 py-1 rounded-xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 text-[11px] font-extrabold shrink-0"
                        >
                          Upload Photo
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Photo Zoom, Pan, Crop & Rotation Controls */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">
                    2. Adjust Photo Inside “{activeSlotSpec.label}”
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveSlotTransform({
                        zoom: 100,
                        panX: 0,
                        panY: 0,
                        rotation: 0,
                        flipX: false,
                        brightness: 100,
                        contrast: 100,
                        cropInset: 0,
                      })
                    }
                    className="text-[11px] font-bold text-cyan-700 hover:underline"
                  >
                    Reset Position
                  </button>
                </div>

                {/* Zoom Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Zoom In / Out</span>
                    <span className="font-mono text-cyan-700">{activeTransform.zoom}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlotTransform({
                          zoom: Math.max(50, activeTransform.zoom - 10),
                        })
                      }
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={50}
                      max={300}
                      value={activeTransform.zoom}
                      onChange={(e) =>
                        updateActiveSlotTransform({ zoom: Number(e.target.value) })
                      }
                      className="flex-1 accent-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlotTransform({
                          zoom: Math.min(300, activeTransform.zoom + 10),
                        })
                      }
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Horizontal & Vertical Reposition Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Horizontal (Left/Right)</span>
                      <span className="font-mono">{activeTransform.panX}px</span>
                    </div>
                    <input
                      type="range"
                      min={-350}
                      max={350}
                      value={activeTransform.panX}
                      onChange={(e) =>
                        updateActiveSlotTransform({ panX: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Vertical (Up/Down)</span>
                      <span className="font-mono">{activeTransform.panY}px</span>
                    </div>
                    <input
                      type="range"
                      min={-350}
                      max={350}
                      value={activeTransform.panY}
                      onChange={(e) =>
                        updateActiveSlotTransform({ panY: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-600"
                    />
                  </div>
                </div>

                {/* Inner Crop Margin & Rotation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Crop Frame Inset</span>
                      <span className="font-mono">{activeTransform.cropInset}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      value={activeTransform.cropInset}
                      onChange={(e) =>
                        updateActiveSlotTransform({ cropInset: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Rotate Photo</span>
                      <span className="font-mono">{activeTransform.rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      value={activeTransform.rotation}
                      onChange={(e) =>
                        updateActiveSlotTransform({ rotation: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-600"
                    />
                  </div>
                </div>

                {/* Brightness, Contrast & Flip */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Brightness</span>
                      <span className="font-mono">{activeTransform.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={65}
                      max={135}
                      value={activeTransform.brightness}
                      onChange={(e) =>
                        updateActiveSlotTransform({ brightness: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Contrast</span>
                      <span className="font-mono">{activeTransform.contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={65}
                      max={135}
                      value={activeTransform.contrast}
                      onChange={(e) =>
                        updateActiveSlotTransform({ contrast: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveSlotTransform({ flipX: !activeTransform.flipX })
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-arrows-left-right"></i>
                    <span>Flip Horizontal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => slotFileInputRef.current?.click()}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-camera-rotate"></i>
                    <span>Replace Photo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: EDITABLE TEXT FIELDS (NAMES, DATE/TIME, VENUE, MESSAGE)
             ================================================================= */}
          {editorPanelTab === 'text' && (
            <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">
                  Edit Poster Text Layers (Auto-Aligned)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTextOverrides((prev) => {
                      const next = { ...prev };
                      activeTemplate.textFields.forEach((f) => {
                        delete next[`${activeTemplate.id}::${f.id}`];
                      });
                      return next;
                    });
                    showToast('Reset text fields to template default');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Reset All Text
                </button>
              </div>

              {activeTemplate.textFields.map((field) => {
                const key = `${activeTemplate.id}::${field.id}`;
                const currentText =
                  textOverrides[key]?.text !== undefined
                    ? textOverrides[key].text
                    : field.defaultValue;
                const currentColor = textOverrides[key]?.color || field.color;
                const currentScale = textOverrides[key]?.fontScale || 100;

                const updateField = (patch: Partial<TextFieldOverride>) => {
                  setTextOverrides((prev) => ({
                    ...prev,
                    [key]: {
                      text: currentText,
                      color: currentColor,
                      fontScale: currentScale,
                      ...patch,
                    },
                  }));
                };

                return (
                  <div
                    key={field.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-extrabold text-slate-800">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentColor}
                          onChange={(e) => updateField({ color: e.target.value })}
                          title="Text Color"
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                        />
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          Size: {currentScale}%
                        </span>
                      </div>
                    </div>

                    <textarea
                      rows={currentText.includes('\n') ? 2 : 1}
                      value={currentText}
                      onChange={(e) => updateField({ text: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-cyan-500"
                    />

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500">Text Size:</span>
                      <input
                        type="range"
                        min={70}
                        max={135}
                        value={currentScale}
                        onChange={(e) =>
                          updateField({ fontScale: Number(e.target.value) })
                        }
                        className="flex-1 accent-cyan-600 h-1.5"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =================================================================
              TAB 3: FULL 36 TEMPLATE GALLERY GRID
             ================================================================= */}
          {editorPanelTab === 'templates' && (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-600">
                Showing {filteredTemplates.length} of 36 Ready-Made Templates:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredTemplates.map((tpl) => {
                  const isSelected = tpl.id === activeTemplate.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        handleSelectTemplate(tpl);
                        setEditorPanelTab('photos');
                      }}
                      className={`p-3 rounded-2xl border text-left transition space-y-2 ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50/60'
                          : 'border-slate-200 bg-slate-50 hover:bg-white'
                      }`}
                    >
                      <div
                        className="h-20 rounded-xl p-2.5 flex flex-col justify-between"
                        style={{
                          background: `linear-gradient(135deg, ${tpl.bgColors[0]}, ${tpl.bgColors[1]}, ${tpl.bgColors[2]})`,
                        }}
                      >
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/80">
                          {tpl.categoryLabel}
                        </span>
                        <span
                          className="text-xs font-extrabold leading-snug"
                          style={{ color: tpl.primaryAccent }}
                        >
                          {tpl.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span>{tpl.badge}</span>
                        <span className="font-mono text-cyan-700">
                          {tpl.photoSlots.length} {tpl.photoSlots.length === 1 ? 'Photo' : 'Photos'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
