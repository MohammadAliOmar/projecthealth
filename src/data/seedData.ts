/**
 * Deterministic, Realistic Mock Dataset Generator for University IT Capstone
 * 
 * Generates 12 realistic groups across 3 courses:
 * - NIT3003 IT Capstone Project 1
 * - NIT3004 IT Capstone Project 2
 * - NIT2102 Software Engineering Practice
 * Target distribution: ~5 Low Risk, ~4 Medium Risk, ~3 High Risk.
 */

import {
  Group,
  GroupMember,
  GroupTask,
  ActivityLog,
  Message,
  HealthSnapshot,
  Alert,
  AuditLog,
  UserProfile,
  ContributingFactor,
  RiskLevel
} from '../types';

export const SEED_COURSES = [
  { code: 'NIT3003', name: 'IT Capstone Project 1' },
  { code: 'NIT3004', name: 'IT Capstone Project 2' },
  { code: 'NIT2102', name: 'Software Engineering Practice' }
];

export function getDefaultUserProfile(uid: string, email: string = 'demo.lecturer@university.edu.au'): UserProfile {
  return {
    uid,
    name: 'Dr. Evelyn Reed',
    email,
    role: 'lecturer',
    courses: SEED_COURSES,
    settings: {
      emailAlerts: true,
      alertLevels: ['High', 'Medium'],
      quietHours: {
        start: '22:00',
        end: '07:00'
      },
      webhookUrl: 'https://university.edu.au/api/capstone/alerts-webhook',
      thresholds: {
        low: 70,
        medium: 40
      },
      dashboardDefaults: {
        sort: 'risk',
        filter: 'all'
      }
    }
  };
}

interface SeedGroupBlueprint {
  groupName: string;
  projectTitle: string;
  courseCode: string;
  status: 'Active' | 'Reviewed' | 'Completed';
  targetRisk: RiskLevel;
  targetScore: number;
  previousScore: number;
  mediumStreak: number;
  memberNames: { name: string; role: string; daysInactive: number }[];
  taskTemplates: { title: string; priority: 'High' | 'Medium' | 'Low'; status: 'Completed' | 'Pending' | 'In Progress' | 'Overdue'; daysDueOffset: number }[];
  recentMessageCount: number;
  lastMessageDaysAgo: number;
  trend: 'stable' | 'declining' | 'recovering' | 'crossed_to_high';
}

const BLUEPRINTS: SeedGroupBlueprint[] = [
  // 1. ANCHOR HIGH: Team Nexus
  {
    groupName: 'Team Nexus',
    projectTitle: 'Hospital Emergency Ward Patient Triage & Bed Allocation System',
    courseCode: 'NIT3003',
    status: 'Active',
    targetRisk: 'High',
    targetScore: 32,
    previousScore: 44,
    mediumStreak: 0,
    memberNames: [
      { name: 'John Smith', role: 'Full Stack Developer', daysInactive: 7 },
      { name: 'Elena Rostova', role: 'Team Lead & Backend Architect', daysInactive: 0 },
      { name: 'Liam Brody', role: 'Database Engineer', daysInactive: 5 },
      { name: 'Aaliyah Patel', role: 'QA & Documentation', daysInactive: 6 }
    ],
    taskTemplates: [
      { title: 'Research Proposal & Ethics Clearance', priority: 'High', status: 'Overdue', daysDueOffset: -5 },
      { title: 'HL7 FHIR Clinical API Ingestion', priority: 'High', status: 'Overdue', daysDueOffset: -3 },
      { title: 'PostgreSQL Bed Reservation Locking', priority: 'High', status: 'Overdue', daysDueOffset: -2 },
      { title: 'Triage Form UI Wireframe', priority: 'Medium', status: 'Completed', daysDueOffset: -10 },
      { title: 'Nurse Authentication Middleware', priority: 'High', status: 'Completed', daysDueOffset: -8 },
      { title: 'Vital Sign Range Checker', priority: 'Low', status: 'Pending', daysDueOffset: 4 },
      { title: 'Audit Trail Export Script', priority: 'Medium', status: 'Pending', daysDueOffset: 7 },
      { title: 'Final Architecture Presentation', priority: 'High', status: 'Pending', daysDueOffset: 14 }
    ],
    recentMessageCount: 2,
    lastMessageDaysAgo: 4,
    trend: 'declining'
  },
  // 2. ANCHOR MEDIUM: Workload imbalance only (Team Vanguard)
  {
    groupName: 'Team Vanguard',
    projectTitle: 'Autonomous Campus Security Drone Airspace Router',
    courseCode: 'NIT3003',
    status: 'Active',
    targetRisk: 'Medium',
    targetScore: 56,
    previousScore: 58,
    mediumStreak: 2,
    memberNames: [
      { name: 'Marcus Sterling', role: 'Lead Architect', daysInactive: 0 },
      { name: 'Samantha Wu', role: 'Firmware Specialist', daysInactive: 1 },
      { name: 'David Okafor', role: 'Frontend Engineer', daysInactive: 2 },
      { name: 'Chloe Vance', role: 'Telemetry Analyst', daysInactive: 1 }
    ],
    taskTemplates: [
      { title: 'Geofence Breach Webhook Service', priority: 'High', status: 'Completed', daysDueOffset: -6 },
      { title: 'Real-time WebSocket Transponder', priority: 'High', status: 'Completed', daysDueOffset: -4 },
      { title: 'Collision Avoidance Matrix', priority: 'High', status: 'Completed', daysDueOffset: -2 },
      { title: 'Battery State Estimation Filter', priority: 'Medium', status: 'In Progress', daysDueOffset: 3 },
      { title: 'Drone Fleet Ground Dashboard', priority: 'Medium', status: 'In Progress', daysDueOffset: 5 },
      { title: 'Automated Return-to-Home Logic', priority: 'Low', status: 'Pending', daysDueOffset: 8 },
      { title: 'Sprint Retrospective 2 Log', priority: 'Low', status: 'Completed', daysDueOffset: -1 }
    ],
    recentMessageCount: 16,
    lastMessageDaysAgo: 1,
    trend: 'stable'
  },
  // 3. ANCHOR LOW: Healthy Low (Team Horizon)
  {
    groupName: 'Team Horizon',
    projectTitle: 'Smart Agriculture Multispectral Crop Yield Prediction Model',
    courseCode: 'NIT3004',
    status: 'Active',
    targetRisk: 'Low',
    targetScore: 92,
    previousScore: 90,
    mediumStreak: 0,
    memberNames: [
      { name: 'Maya Lin', role: 'ML Engineer & Lead', daysInactive: 0 },
      { name: 'Carlos Ruiz', role: 'Data Pipeline Specialist', daysInactive: 0 },
      { name: 'Devon Ward', role: 'Cloud Deployment', daysInactive: 1 },
      { name: 'Hannah Fischer', role: 'Field Test Coordinator', daysInactive: 0 }
    ],
    taskTemplates: [
      { title: 'Sentinel-2 Cloud Mask Filter', priority: 'High', status: 'Completed', daysDueOffset: -12 },
      { title: 'Vision Transformer Fine-tuning', priority: 'High', status: 'Completed', daysDueOffset: -8 },
      { title: 'Triton Inference Engine Dockerfile', priority: 'High', status: 'Completed', daysDueOffset: -5 },
      { title: 'GeoTIFF Ingestion Microservice', priority: 'Medium', status: 'Completed', daysDueOffset: -2 },
      { title: 'Farmer Web Dashboard Latency Test', priority: 'Medium', status: 'Completed', daysDueOffset: -1 },
      { title: 'Offline Mobile Caching Service Worker', priority: 'Medium', status: 'In Progress', daysDueOffset: 4 },
      { title: 'Final Demonstration Pitch Deck', priority: 'High', status: 'Pending', daysDueOffset: 12 }
    ],
    recentMessageCount: 38,
    lastMessageDaysAgo: 0,
    trend: 'stable'
  },
  // 4. ANCHOR: Recently Recovered from Medium to Low (Team Apex)
  {
    groupName: 'Team Apex',
    projectTitle: 'Decentralized Microgrid Solar Arbitrage Optimizer',
    courseCode: 'NIT3004',
    status: 'Reviewed',
    targetRisk: 'Low',
    targetScore: 78,
    previousScore: 54,
    mediumStreak: 0,
    memberNames: [
      { name: 'Kenji Sato', role: 'Optimization Engineer', daysInactive: 0 },
      { name: 'Amara Okafor', role: 'Smart Contract Developer', daysInactive: 1 },
      { name: 'Lucas Meyer', role: 'Frontend Designer', daysInactive: 1 }
    ],
    taskTemplates: [
      { title: 'Tariff Rate Web Scraper Fix', priority: 'High', status: 'Completed', daysDueOffset: -3 },
      { title: 'Battery Charge Optimization LP Solver', priority: 'High', status: 'Completed', daysDueOffset: -2 },
      { title: 'Modbus TCP Inverter Driver', priority: 'Medium', status: 'Completed', daysDueOffset: -1 },
      { title: 'Emergency Shutoff Safety Interlock', priority: 'High', status: 'Completed', daysDueOffset: -1 },
      { title: 'Grid Operator Portal Validation', priority: 'Medium', status: 'In Progress', daysDueOffset: 5 },
      { title: 'User Manual & Test Plan', priority: 'Low', status: 'Pending', daysDueOffset: 10 }
    ],
    recentMessageCount: 22,
    lastMessageDaysAgo: 1,
    trend: 'recovering'
  },
  // 5. ANCHOR: Just Crossed Medium to High (Team Pulse)
  {
    groupName: 'Team Pulse',
    projectTitle: 'Wearable ECG Arrhythmia Edge Detection for Cardiac Patients',
    courseCode: 'NIT2102',
    status: 'Active',
    targetRisk: 'High',
    targetScore: 37,
    previousScore: 48,
    mediumStreak: 4,
    memberNames: [
      { name: 'David Kim', role: 'DSP Firmware Specialist', daysInactive: 0 },
      { name: 'Zoe Martinez', role: 'Edge AI Quantization', daysInactive: 6 },
      { name: 'Brandon Cole', role: 'Mobile Companion App', daysInactive: 5 }
    ],
    taskTemplates: [
      { title: 'QRS Peak Detection Filter', priority: 'High', status: 'Completed', daysDueOffset: -9 },
      { title: 'TensorFlow Lite Micro INT8 Kernel', priority: 'High', status: 'Overdue', daysDueOffset: -4 },
      { title: 'BLE 5.0 Continuous Heartbeat Streamer', priority: 'High', status: 'Overdue', daysDueOffset: -3 },
      { title: 'iOS CoreBluetooth Sync Background Mode', priority: 'Medium', status: 'Overdue', daysDueOffset: -2 },
      { title: 'Cardiologist Alert Webhook Dispatch', priority: 'Low', status: 'Pending', daysDueOffset: 7 }
    ],
    recentMessageCount: 4,
    lastMessageDaysAgo: 3,
    trend: 'crossed_to_high'
  },
  // 6. LOW: Team Solis
  {
    groupName: 'Team Solis',
    projectTitle: 'Smart EV Charging Station Load Shedding & Grid Relief',
    courseCode: 'NIT2102',
    status: 'Active',
    targetRisk: 'Low',
    targetScore: 84,
    previousScore: 82,
    mediumStreak: 0,
    memberNames: [
      { name: 'Chloe Bennett', role: 'Power Systems Lead', daysInactive: 0 },
      { name: 'Tariq Mansour', role: 'OCPP 2.0 Protocol Lead', daysInactive: 1 },
      { name: 'Jessica Vance', role: 'Full Stack Engineer', daysInactive: 0 }
    ],
    taskTemplates: [
      { title: 'OCPP 2.0.1 WebSocket Client', priority: 'High', status: 'Completed', daysDueOffset: -10 },
      { title: 'Dynamic Tariff Ingestion Job', priority: 'Medium', status: 'Completed', daysDueOffset: -7 },
      { title: 'Peak Load Detection Heuristic', priority: 'High', status: 'Completed', daysDueOffset: -3 },
      { title: 'Fleet Driver Mobile Reservation Screen', priority: 'Medium', status: 'In Progress', daysDueOffset: 3 },
      { title: 'Security Audit & TLS Hardening', priority: 'High', status: 'Pending', daysDueOffset: 8 }
    ],
    recentMessageCount: 26,
    lastMessageDaysAgo: 0,
    trend: 'stable'
  },
  // 7. MEDIUM: Team Orion
  {
    groupName: 'Team Orion',
    projectTitle: 'University Campus IoT Indoor Air Quality & Ventilation Controller',
    courseCode: 'NIT3003',
    status: 'Active',
    targetRisk: 'Medium',
    targetScore: 61,
    previousScore: 65,
    mediumStreak: 3,
    memberNames: [
      { name: 'Benjamin Hayes', role: 'Hardware & Sensor Engineer', daysInactive: 1 },
      { name: 'Grace Hopper-Lee', role: 'Backend Ingestion Lead', daysInactive: 2 },
      { name: 'Tobias King', role: 'Frontend Dashboard', daysInactive: 4 },
      { name: 'Fatima Al-Mansoor', role: 'Data Analyst', daysInactive: 2 }
    ],
    taskTemplates: [
      { title: 'MQTT Broker Clustering Setup', priority: 'High', status: 'Completed', daysDueOffset: -11 },
      { title: 'CO2 Sensor Calibration Protocol', priority: 'Medium', status: 'Completed', daysDueOffset: -6 },
      { title: 'HVAC Fan Speed Relay Actuator Logic', priority: 'High', status: 'Overdue', daysDueOffset: -1 },
      { title: 'Real-time Heatmap Canvas Renderer', priority: 'Medium', status: 'In Progress', daysDueOffset: 3 },
      { title: 'Occupancy Detection OpenCV Pipeline', priority: 'High', status: 'Pending', daysDueOffset: 6 }
    ],
    recentMessageCount: 14,
    lastMessageDaysAgo: 2,
    trend: 'stable'
  },
  // 8. HIGH: Team Quantum
  {
    groupName: 'Team Quantum',
    projectTitle: 'Autonomous Wheelchair Navigation with LiDAR Obstacle Avoidance',
    courseCode: 'NIT3004',
    status: 'Active',
    targetRisk: 'High',
    targetScore: 28,
    previousScore: 35,
    mediumStreak: 0,
    memberNames: [
      { name: 'Arthur Pendelton', role: 'ROS2 Robotics Lead', daysInactive: 1 },
      { name: 'Sophie Zhang', role: 'SLAM Algorithm Developer', daysInactive: 8 },
      { name: 'Devante Jackson', role: 'Motor Controller Firmware', daysInactive: 6 }
    ],
    taskTemplates: [
      { title: 'ROS2 Node Graph Architecture Document', priority: 'High', status: 'Completed', daysDueOffset: -14 },
      { title: 'LiDAR 2D Point Cloud Fast Filter', priority: 'High', status: 'Overdue', daysDueOffset: -7 },
      { title: 'Motor CAN Bus Safe Braking Interlock', priority: 'High', status: 'Overdue', daysDueOffset: -5 },
      { title: 'Costmap Local Path Planning Node', priority: 'High', status: 'Overdue', daysDueOffset: -3 },
      { title: 'Assistive Joystick Threshold Calibrator', priority: 'Low', status: 'Pending', daysDueOffset: 4 }
    ],
    recentMessageCount: 1,
    lastMessageDaysAgo: 5,
    trend: 'declining'
  },
  // 9. LOW: Team Beacon
  {
    groupName: 'Team Beacon',
    projectTitle: 'Peer-to-Peer Academic Notes Marketplace with Content Moderation',
    courseCode: 'NIT2102',
    status: 'Active',
    targetRisk: 'Low',
    targetScore: 89,
    previousScore: 85,
    mediumStreak: 0,
    memberNames: [
      { name: 'Claire Dubois', role: 'Lead Frontend Developer', daysInactive: 0 },
      { name: 'Owen Murphy', role: 'Cloud Infrastructure & Auth', daysInactive: 0 },
      { name: 'Siddharth Nair', role: 'Text Similarity AI Pipeline', daysInactive: 1 },
      { name: 'Zane Gallagher', role: 'Payment Integration', daysInactive: 0 }
    ],
    taskTemplates: [
      { title: 'Stripe Connect Seller Onboarding', priority: 'High', status: 'Completed', daysDueOffset: -10 },
      { title: 'PDF Watermarking & Encryption Lambda', priority: 'High', status: 'Completed', daysDueOffset: -6 },
      { title: 'Cosine Similarity Plagiarism Screener', priority: 'High', status: 'Completed', daysDueOffset: -3 },
      { title: 'University Single Sign-On SAML Probe', priority: 'Medium', status: 'Completed', daysDueOffset: -1 },
      { title: 'Search Engine Elastic Indexing', priority: 'Medium', status: 'In Progress', daysDueOffset: 4 },
      { title: 'Moderation Queue Review Dashboard', priority: 'Medium', status: 'In Progress', daysDueOffset: 7 }
    ],
    recentMessageCount: 34,
    lastMessageDaysAgo: 0,
    trend: 'stable'
  },
  // 10. MEDIUM: Team Cipher
  {
    groupName: 'Team Cipher',
    projectTitle: 'Automated Vulnerability Scanner for Smart Contracts',
    courseCode: 'NIT3003',
    status: 'Active',
    targetRisk: 'Medium',
    targetScore: 52,
    previousScore: 55,
    mediumStreak: 2,
    memberNames: [
      { name: 'Gavin Ross', role: 'Static Analysis Specialist', daysInactive: 2 },
      { name: 'Aria Thorne', role: 'Parser & AST Generator', daysInactive: 0 },
      { name: 'Kenzo Takahashi', role: 'CLI & Reporter Tooling', daysInactive: 4 }
    ],
    taskTemplates: [
      { title: 'Solidity Abstract Syntax Tree Parser', priority: 'High', status: 'Completed', daysDueOffset: -9 },
      { title: 'Reentrancy Vulnerability Detection Rule', priority: 'High', status: 'Completed', daysDueOffset: -5 },
      { title: 'Integer Overflow Symbolic Execution Unit', priority: 'High', status: 'Overdue', daysDueOffset: -2 },
      { title: 'SARIF Format Security Report Generator', priority: 'Medium', status: 'In Progress', daysDueOffset: 3 },
      { title: 'GitHub Actions Marketplace Integration', priority: 'Low', status: 'Pending', daysDueOffset: 9 }
    ],
    recentMessageCount: 11,
    lastMessageDaysAgo: 2,
    trend: 'stable'
  },
  // 11. LOW: Team Echo
  {
    groupName: 'Team Echo',
    projectTitle: 'Speech-to-Text Classroom Lecture Summarizer with Mind Maps',
    courseCode: 'NIT3004',
    status: 'Active',
    targetRisk: 'Low',
    targetScore: 86,
    previousScore: 84,
    mediumStreak: 0,
    memberNames: [
      { name: 'Kylie Jensen', role: 'Full Stack & Audio Streaming', daysInactive: 0 },
      { name: 'Mateo Silva', role: 'Whisper AI Fine-tuning', daysInactive: 0 },
      { name: 'Priya Sharma', role: 'Mermaid.js Mindmap Generator', daysInactive: 1 }
    ],
    taskTemplates: [
      { title: 'WebRTC Low-Latency Mic Streaming', priority: 'High', status: 'Completed', daysDueOffset: -12 },
      { title: 'Speaker Diarization Pipeline Unit', priority: 'High', status: 'Completed', daysDueOffset: -7 },
      { title: 'LLM Key Term Concept Extraction Prompt', priority: 'High', status: 'Completed', daysDueOffset: -4 },
      { title: 'Interactive Mindmap Export to SVG', priority: 'Medium', status: 'Completed', daysDueOffset: -1 },
      { title: 'Flashcard Quiz Generator Feature', priority: 'Medium', status: 'In Progress', daysDueOffset: 4 }
    ],
    recentMessageCount: 30,
    lastMessageDaysAgo: 0,
    trend: 'stable'
  },
  // 12. MEDIUM: Team Terra
  {
    groupName: 'Team Terra',
    projectTitle: 'Bushfire Early Smoke Detection Mesh Network with LoRaWAN',
    courseCode: 'NIT2102',
    status: 'Active',
    targetRisk: 'Medium',
    targetScore: 48,
    previousScore: 50,
    mediumStreak: 3,
    memberNames: [
      { name: 'Rowan Vance', role: 'LoRaWAN Gateway Engineer', daysInactive: 1 },
      { name: 'Isla MacDonald', role: 'Edge Thermal Camera Model', daysInactive: 3 },
      { name: 'Naveen Reddy', role: 'GIS Mapping & Leaflet UI', daysInactive: 4 },
      { name: 'Zackary Cross', role: 'Solar Power Management', daysInactive: 2 }
    ],
    taskTemplates: [
      { title: 'LoRa Packet Ingestion Server Node', priority: 'High', status: 'Completed', daysDueOffset: -8 },
      { title: 'Thermal Gradient Delta Trigger Filter', priority: 'High', status: 'Completed', daysDueOffset: -4 },
      { title: 'Leaflet Real-time Fire Perimeter Polygon', priority: 'High', status: 'Overdue', daysDueOffset: -2 },
      { title: 'SMS Gateway Dispatch for Rural Brigades', priority: 'High', status: 'In Progress', daysDueOffset: 2 },
      { title: 'Solar Battery State Watchdog Daemon', priority: 'Medium', status: 'Pending', daysDueOffset: 6 }
    ],
    recentMessageCount: 8,
    lastMessageDaysAgo: 2,
    trend: 'stable'
  }
];

export function generateSeedDataset(lecturerId: string, referenceDate: Date = new Date()) {
  const now = referenceDate;

  const groups: Group[] = [];
  const allMembers: GroupMember[] = [];
  const allTasks: GroupTask[] = [];
  const allLogs: ActivityLog[] = [];
  const allMessages: Message[] = [];
  const allSnapshots: HealthSnapshot[] = [];
  const allAlerts: Alert[] = [];
  const allAudits: AuditLog[] = [];

  BLUEPRINTS.forEach((bp, gIdx) => {
    const groupId = `grp_${gIdx + 1}`;
    const memberCount = bp.memberNames.length;

    // Build members
    const groupMembers: GroupMember[] = bp.memberNames.map((m, mIdx) => {
      const joinedDate = new Date(now.getTime() - (28 - mIdx * 2) * 24 * 60 * 60 * 1000);
      return {
        id: `mem_${gIdx + 1}_${mIdx + 1}`,
        lecturerId,
        name: m.name,
        role: m.role,
        joinedAt: joinedDate.toISOString(),
        tasksCompleted: 0,
        daysSinceLastActivity: m.daysInactive
      };
    });

    // Build tasks
    let dominantIndex = 0;
    const groupTasks: GroupTask[] = bp.taskTemplates.map((t, tIdx) => {
      const taskId = `tsk_${gIdx + 1}_${tIdx + 1}`;
      const dueDate = new Date(now.getTime() + t.daysDueOffset * 24 * 60 * 60 * 1000);

      // Workload imbalance anchor logic: if Team Nexus or Team Vanguard, concentrate completions on dominant member
      let assigneeMember = groupMembers[tIdx % memberCount];
      if (bp.groupName === 'Team Nexus') {
        // Elena Rostova holds ~65% of completions
        assigneeMember = (t.status === 'Completed' && tIdx % 3 !== 0) ? groupMembers[1] : groupMembers[tIdx % memberCount];
      } else if (bp.groupName === 'Team Vanguard') {
        // Marcus Sterling holds dominant share
        assigneeMember = (t.status === 'Completed' && tIdx % 2 === 0) ? groupMembers[0] : groupMembers[tIdx % memberCount];
      }

      const completedAt = t.status === 'Completed'
        ? new Date(now.getTime() - Math.abs(t.daysDueOffset + 2) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      if (t.status === 'Completed') {
        assigneeMember.tasksCompleted = (assigneeMember.tasksCompleted || 0) + 1;
      }

      return {
        id: taskId,
        lecturerId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: dueDate.toISOString(),
        assigneeId: assigneeMember.id,
        completedAt,
        completedById: completedAt ? assigneeMember.id : null
      };
    });

    // Calculate contribution percentages
    const totalDone = groupTasks.filter(t => t.status === 'Completed').length;
    groupMembers.forEach(m => {
      m.contributionPercent = totalDone > 0 ? Math.round(((m.tasksCompleted || 0) / totalDone) * 100) : Math.round(100 / memberCount);
    });

    // Build 14 days of activity logs
    for (let day = 14; day >= 0; day--) {
      const logDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000 + (gIdx * 100000));
      // Inactive members don't log recent activity
      groupMembers.forEach((m, mIdx) => {
        const bpMember = bp.memberNames[mIdx];
        if (day < bpMember.daysInactive) return; // Skip if currently inactive

        if ((day + mIdx + gIdx) % 3 === 0) {
          allLogs.push({
            id: `log_${gIdx + 1}_${day}_${mIdx}`,
            lecturerId,
            userId: m.id,
            userName: m.name,
            actionType: day % 2 === 0 ? 'commit' : 'task_completed',
            timestamp: logDate.toISOString()
          });
        }
      });
    }

    // Build messages
    for (let mCount = 0; mCount < bp.recentMessageCount; mCount++) {
      const msgDaysAgo = bp.lastMessageDaysAgo + Math.floor((mCount / bp.recentMessageCount) * 6);
      const msgDate = new Date(now.getTime() - msgDaysAgo * 24 * 60 * 60 * 1000 + mCount * 3600000);
      const sender = groupMembers[mCount % memberCount];

      allMessages.push({
        id: `msg_${gIdx + 1}_${mCount + 1}`,
        lecturerId,
        senderId: sender.id,
        senderName: sender.name,
        content: mCount % 2 === 0
          ? `Sprint update: committed latest changes for the milestone delivery.`
          : `Can we sync during the laboratory standup tomorrow?`,
        timestamp: msgDate.toISOString()
      });
    }

    // Build 30 daily health snapshots for believable sparklines and trend charts
    const recentSnapshots: HealthSnapshot[] = [];
    for (let day = 30; day >= 0; day--) {
      const snapDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      let dayScore = bp.targetScore;

      if (bp.trend === 'declining') {
        // e.g. from 60 down to 32
        dayScore = Math.round(bp.targetScore + (day * 1.0));
      } else if (bp.trend === 'recovering') {
        // e.g. from 50 up to 78
        dayScore = Math.round(bp.targetScore - (day * 0.9));
      } else if (bp.trend === 'crossed_to_high') {
        // dropped sharply from 55 to 37 in the last 4 days
        dayScore = day <= 4 ? Math.round(bp.targetScore + day * 1.5) : Math.round(52 + (day % 3));
      } else {
        // stable variation
        dayScore = Math.round(bp.targetScore + Math.sin(day) * 3);
      }

      dayScore = Math.max(15, Math.min(98, dayScore));
      const snapRisk: RiskLevel = dayScore >= 70 ? 'Low' : dayScore >= 40 ? 'Medium' : 'High';

      const snap: HealthSnapshot = {
        id: `snp_${gIdx + 1}_${day}`,
        lecturerId,
        score: dayScore,
        riskLevel: snapRisk,
        riskExplanation: snapRisk === 'High' 
          ? 'Multiple overdue sprint deliverables and low team participation velocity.'
          : snapRisk === 'Medium'
            ? 'Minor task delays and unequal distribution of completed tasks.'
            : 'Steady task velocity and balanced sprint contributions.',
        topFactors: [
          { factor: 'Task Velocity', description: 'Sprint tasks progress relative to milestone deadlines.' }
        ],
        recommendation: snapRisk === 'High' ? 'Contact the inactive student' : 'Continue monitoring project progress.',
        snapshotTimestamp: snapDate.toISOString()
      };

      allSnapshots.push(snap);
      recentSnapshots.push(snap);
    }

    // Determine last activity string
    const lastActivityDate = new Date(now.getTime() - bp.lastMessageDaysAgo * 24 * 60 * 60 * 1000);

    const groupDoc: Group = {
      id: groupId,
      lecturerId,
      groupName: bp.groupName,
      projectTitle: bp.projectTitle,
      courseCode: bp.courseCode,
      status: bp.status,
      memberCount,
      lastActivityAt: lastActivityDate.toISOString(),
      latestScore: bp.targetScore,
      latestRisk: bp.targetRisk,
      previousScore: bp.previousScore,
      mediumStreak: bp.mediumStreak,
      members: groupMembers,
      tasks: groupTasks,
      recentSnapshots: recentSnapshots.slice(-14)
    };

    groups.push(groupDoc);
    allMembers.push(...groupMembers);
    allTasks.push(...groupTasks);
  });

  // Generate ~15 realistic alerts with mixed statuses (~4 unread/New)
  const alertBlueprints = [
    {
      group: groups[0], // Team Nexus (High)
      risk: 'High' as RiskLevel,
      score: 32,
      trigger: 'critical_overdue' as const,
      status: 'New' as const,
      factors: [
        { factor: 'Overdue Tasks', description: 'Research Proposal is 5 days overdue.' },
        { factor: 'Member Inactivity', description: 'Member "John Smith" has not contributed for 7 days.' }
      ],
      recommendation: 'Contact the inactive student and review research proposal deadlines.',
      hoursAgo: 2
    },
    {
      group: groups[4], // Team Pulse (Crossed to High)
      risk: 'High' as RiskLevel,
      score: 37,
      trigger: 'risk_worsened' as const,
      status: 'New' as const,
      factors: [
        { factor: 'Risk Transition', description: 'Project health crossed from Medium into High risk.' },
        { factor: 'Overdue Tasks', description: '3 critical BLE and kernel tasks are overdue.' }
      ],
      recommendation: 'Schedule an emergency consultation with the group.',
      hoursAgo: 5
    },
    {
      group: groups[7], // Team Quantum (High)
      risk: 'High' as RiskLevel,
      score: 28,
      trigger: 'critical_inactive' as const,
      status: 'New' as const,
      factors: [
        { factor: 'Member Inactivity', description: 'Sophie Zhang has been inactive for 8 days.' },
        { factor: 'Overdue Tasks', description: 'LiDAR filter is 7 days overdue.' }
      ],
      recommendation: 'Contact the inactive student immediately.',
      hoursAgo: 8
    },
    {
      group: groups[1], // Team Vanguard (Workload Imbalance)
      risk: 'Medium' as RiskLevel,
      score: 56,
      trigger: 'medium_streak' as const,
      status: 'New' as const,
      factors: [
        { factor: 'Workload Imbalance', description: 'Member "Marcus Sterling" has completed 65% of all completed tasks.' }
      ],
      recommendation: 'Review task allocation with the group.',
      hoursAgo: 14
    },
    {
      group: groups[6], // Team Orion (Medium)
      risk: 'Medium' as RiskLevel,
      score: 61,
      trigger: 'medium_streak' as const,
      status: 'Read' as const,
      factors: [
        { factor: 'Overdue Tasks', description: 'HVAC relay task overdue by 1 day.' }
      ],
      recommendation: 'Review task allocation and deadlines.',
      hoursAgo: 26
    },
    {
      group: groups[9], // Team Cipher (Medium)
      risk: 'Medium' as RiskLevel,
      score: 52,
      trigger: 'medium_streak' as const,
      status: 'Read' as const,
      factors: [
        { factor: 'Overdue Tasks', description: 'Integer overflow unit is 2 days overdue.' },
        { factor: 'Member Inactivity', description: 'Kenzo Takahashi inactive for 4 days.' }
      ],
      recommendation: 'Check on student progress.',
      hoursAgo: 38
    },
    {
      group: groups[11], // Team Terra (Medium)
      risk: 'Medium' as RiskLevel,
      score: 48,
      trigger: 'medium_streak' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Overdue Tasks', description: 'Leaflet real-time perimeter task overdue by 2 days.' }
      ],
      recommendation: 'Review task allocation.',
      hoursAgo: 48
    },
    {
      group: groups[3], // Team Apex (Recovered to Low)
      risk: 'Low' as RiskLevel,
      score: 78,
      trigger: 'risk_worsened' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Recovery Milestone', description: 'Team resolved overdue inverter drivers and recovered to Low Risk.' }
      ],
      recommendation: 'Continue monitoring project progress.',
      hoursAgo: 52
    },
    {
      group: groups[0], // Team Nexus older alert
      risk: 'Medium' as RiskLevel,
      score: 44,
      trigger: 'medium_streak' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Task Velocity', description: 'Sprint completion rate dropped below 40%.' }
      ],
      recommendation: 'Schedule advisory meeting.',
      hoursAgo: 72
    },
    {
      group: groups[4], // Team Pulse older alert
      risk: 'Medium' as RiskLevel,
      score: 48,
      trigger: 'critical_overdue' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Overdue Tasks', description: 'INT8 kernel overdue by 1 day.' }
      ],
      recommendation: 'Review task allocation.',
      hoursAgo: 96
    },
    {
      group: groups[7], // Team Quantum older alert
      risk: 'High' as RiskLevel,
      score: 35,
      trigger: 'high_risk' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Critical Delays', description: 'LiDAR and CAN bus tasks blocked.' }
      ],
      recommendation: 'Emergency check-in required.',
      hoursAgo: 120
    },
    {
      group: groups[2], // Team Horizon periodic audit
      risk: 'Low' as RiskLevel,
      score: 90,
      trigger: 'risk_worsened' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Milestone Delivery', description: 'All Sprint 3 deliverables completed on schedule.' }
      ],
      recommendation: 'Continue monitoring project progress.',
      hoursAgo: 140
    },
    {
      group: groups[5], // Team Solis
      risk: 'Low' as RiskLevel,
      score: 82,
      trigger: 'risk_worsened' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Milestone Progress', description: 'OCPP 2.0 protocol pass confirmed.' }
      ],
      recommendation: 'Continue monitoring.',
      hoursAgo: 168
    },
    {
      group: groups[8], // Team Beacon
      risk: 'Low' as RiskLevel,
      score: 85,
      trigger: 'risk_worsened' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'SAML Authentication', description: 'SSO probe milestone delivered.' }
      ],
      recommendation: 'Continue monitoring.',
      hoursAgo: 190
    },
    {
      group: groups[10], // Team Echo
      risk: 'Low' as RiskLevel,
      score: 84,
      trigger: 'risk_worsened' as const,
      status: 'Reviewed' as const,
      factors: [
        { factor: 'Lecture Summarizer', description: 'Audio stream latency metrics passed.' }
      ],
      recommendation: 'Continue monitoring.',
      hoursAgo: 210
    }
  ];

  alertBlueprints.forEach((ab, aIdx) => {
    const alertId = `alt_${aIdx + 1}`;
    const createdDate = new Date(now.getTime() - ab.hoursAgo * 3600 * 1000);

    // Simulated deliveries log showing delivery attempts and retry logic
    const deliveries = [
      {
        channel: 'in_app' as const,
        status: 'Sent' as const,
        attempts: 1,
        timestamp: createdDate.toISOString()
      },
      {
        channel: 'email' as const,
        status: 'Sent' as const,
        attempts: 1,
        timestamp: createdDate.toISOString()
      },
      {
        channel: 'webhook' as const,
        // Make alert #2 show a simulated failed attempt with retries
        status: aIdx === 1 ? ('Failed' as const) : ('Sent' as const),
        attempts: aIdx === 1 ? 3 : 1,
        timestamp: createdDate.toISOString(),
        error: aIdx === 1 ? 'HTTP 504 Gateway Timeout (Exceeded 3 retries)' : undefined
      }
    ];

    allAlerts.push({
      id: alertId,
      lecturerId,
      groupId: ab.group.id,
      groupName: ab.group.groupName,
      projectName: ab.group.projectTitle,
      riskLevel: ab.risk,
      healthScore: ab.score,
      contributingFactors: ab.factors,
      recommendation: ab.recommendation,
      triggerType: ab.trigger,
      status: ab.status,
      deliveries,
      createdAt: createdDate.toISOString()
    });
  });

  // Seed initial audit log events
  allAudits.push(
    {
      id: `aud_1`,
      lecturerId,
      event: `Lecturer initialized ProjectHealth AI capstone monitoring workspace`,
      timestamp: new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: `aud_2`,
      lecturerId,
      event: `Automated assessment completed for 12 groups across NIT3003, NIT3004, NIT2102`,
      timestamp: new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
    }
  );

  return {
    groups,
    allMembers,
    allTasks,
    allLogs,
    allMessages,
    allSnapshots,
    allAlerts,
    allAudits
  };
}
