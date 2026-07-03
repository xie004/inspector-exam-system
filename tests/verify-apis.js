const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'inspector-assessment-system-jwt-secret-key-2026-secured';
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING BACKEND API VERIFICATION TESTS ---');

  // 1. Fetch department and standard from DB for testing
  const department = await prisma.department.findFirst({
    where: { name: '化学检测部' }
  });
  if (!department) {
    console.error('Error: Chemical department not found. Please seed the DB first.');
    process.exit(1);
  }

  const standard = await prisma.standard.findFirst();
  let standardId = null;
  if (standard) {
    standardId = standard.id;
    console.log(`Using existing Standard: "${standard.title}" (${standard.id})`);
  } else {
    // Create a dummy standard for testing if not exists
    const newStd = await prisma.standard.create({
      data: {
        title: 'GB/T 2828.1-2012 Test Standard',
        fileType: 'pdf',
        extractedText: 'Test extracted standard rules and guidelines.',
        departmentId: department.id,
        status: 'AVAILABLE'
      }
    });
    standardId = newStd.id;
    console.log(`Created dummy Standard: "${newStd.title}" (${newStd.id})`);
  }

  // Find or create test user for creator role
  let creator = await prisma.user.findUnique({
    where: { username: 'creator' }
  });
  if (!creator) {
    console.error('Error: Creator user not found. Please seed the DB first.');
    process.exit(1);
  }

  // 2. Generate signed JWT token
  const token = jwt.sign({
    userId: creator.id,
    username: creator.username,
    role: creator.role,
    realName: creator.realName,
    employeeId: creator.employeeId,
    departmentId: creator.departmentId
  }, JWT_SECRET, { expiresIn: '1h' });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const testTitle = 'Verification Test Exam ' + Date.now();

  // Test Case 1: Create a new exam with unique title (Should succeed)
  console.log('\n[Test Case 1] Create unique exam paper:');
  const response1 = await fetch(`${BASE_URL}/api/creator/exams`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: testTitle,
      standardId,
      timeLimit: 60,
      questions: [
        {
          type: 'SINGLE',
          content: 'What is the standard tolerance limit?',
          options: ['A. 1%', 'B. 2%', 'C. 3%', 'D. 4%'],
          correctAnswer: 'A',
          score: 5,
          explanation: 'As per standard section 3.2',
          knowledgePoint: '3.2 Tolerance'
        }
      ]
    })
  });
  const result1 = await response1.json();
  console.log(`Status: ${response1.status}`);
  console.log(`Result:`, result1);
  if (response1.status !== 200 || !result1.success) {
    console.error('FAIL: Could not create test exam paper.');
    process.exit(1);
  }
  const examId = result1.exam.id;

  // Test Case 2: Create exam with duplicate title (Should fail 400)
  console.log('\n[Test Case 2] Create exam with duplicate title:');
  const response2 = await fetch(`${BASE_URL}/api/creator/exams`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: testTitle,
      standardId,
      timeLimit: 60,
      questions: [
        {
          type: 'SINGLE',
          content: 'Duplicate title check question?',
          options: ['A. Yes', 'B. No'],
          correctAnswer: 'A',
          score: 5,
          explanation: 'None',
          knowledgePoint: 'General'
        }
      ]
    })
  });
  const result2 = await response2.json();
  console.log(`Status: ${response2.status}`);
  console.log(`Result:`, result2);
  if (response2.status !== 400 || result2.error !== '试卷标题已存在，请使用其他名称') {
    console.error('FAIL: Duplicate title check did not block exam creation or returned wrong error.');
    process.exit(1);
  } else {
    console.log('PASS: Duplicate title correctly blocked with status 400 and proper message.');
  }

  // Test Case 3: Create exam with empty title (Should fail 400)
  console.log('\n[Test Case 3] Create exam with empty title:');
  const response3 = await fetch(`${BASE_URL}/api/creator/exams`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: '   ',
      standardId,
      timeLimit: 60,
      questions: [
        {
          type: 'SINGLE',
          content: 'Empty title check question?',
          options: ['A. Yes', 'B. No'],
          correctAnswer: 'A',
          score: 5,
          explanation: 'None',
          knowledgePoint: 'General'
        }
      ]
    })
  });
  const result3 = await response3.json();
  console.log(`Status: ${response3.status}`);
  console.log(`Result:`, result3);
  if (response3.status !== 400 || result3.error !== '请填写试卷标题') {
    console.error('FAIL: Empty title check failed.');
    process.exit(1);
  } else {
    console.log('PASS: Empty title check correctly blocked.');
  }

  // Test Case 4: Create exam with invalid/negative timeLimit (Should fail 400)
  console.log('\n[Test Case 4] Create exam with invalid timeLimit (0):');
  const response4 = await fetch(`${BASE_URL}/api/creator/exams`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: testTitle + ' Unique',
      standardId,
      timeLimit: 0,
      questions: [
        {
          type: 'SINGLE',
          content: 'Time limit check?',
          options: ['A. Yes', 'B. No'],
          correctAnswer: 'A',
          score: 5,
          explanation: 'None',
          knowledgePoint: 'General'
        }
      ]
    })
  });
  const result4 = await response4.json();
  console.log(`Status: ${response4.status}`);
  console.log(`Result:`, result4);
  if (response4.status !== 400 || result4.error !== '考试时长必须大于 0 分钟') {
    console.error('FAIL: Invalid time limit check failed.');
    process.exit(1);
  } else {
    console.log('PASS: Invalid time limit check correctly blocked.');
  }

  // Test Case 5: Create exam with empty questions (Should fail 400)
  console.log('\n[Test Case 5] Create exam with empty questions array:');
  const response5 = await fetch(`${BASE_URL}/api/creator/exams`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: testTitle + ' Unique 2',
      standardId,
      timeLimit: 60,
      questions: []
    })
  });
  const result5 = await response5.json();
  console.log(`Status: ${response5.status}`);
  console.log(`Result:`, result5);
  if (response5.status !== 400 || result5.error !== '试卷必须包含至少一道题目') {
    console.error('FAIL: Empty questions check failed.');
    process.exit(1);
  } else {
    console.log('PASS: Empty questions check correctly blocked.');
  }

  // Test Case 6: Edit exam with its own title (Should succeed)
  console.log('\n[Test Case 6] Edit exam preserving its own title:');
  const response6 = await fetch(`${BASE_URL}/api/creator/exams`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: examId,
      title: testTitle,
      standardId,
      timeLimit: 45,
      questions: [
        {
          type: 'SINGLE',
          content: 'Updated tolerance question?',
          options: ['A. 1%', 'B. 5%'],
          correctAnswer: 'B',
          score: 10,
          explanation: 'Updated detail',
          knowledgePoint: '3.2 Tolerance'
        }
      ]
    })
  });
  const result6 = await response6.json();
  console.log(`Status: ${response6.status}`);
  console.log(`Result:`, result6);
  if (response6.status !== 200 || !result6.success) {
    console.error('FAIL: Self-update with same title failed.');
    process.exit(1);
  } else {
    console.log('PASS: Self-update with same title succeeded.');
  }

  // Test Case 7: AI Generate exam with duplicate title (Should fail 400)
  console.log('\n[Test Case 7] AI Generate exam with duplicate title:');
  const response7 = await fetch(`${BASE_URL}/api/creator/exams/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      standardId,
      title: testTitle,
      timeLimit: 90,
      config: {
        SINGLE: { count: 5, score: 2 }
      }
    })
  });
  const result7 = await response7.json();
  console.log(`Status: ${response7.status}`);
  console.log(`Result:`, result7);
  if (response7.status !== 400 || result7.error !== '试卷标题已存在，请使用其他名称') {
    console.error('FAIL: AI Generate duplicate title check failed or returned wrong error.');
    process.exit(1);
  } else {
    console.log('PASS: AI Generate duplicate title check correctly blocked.');
  }

  // Test Case 8: AI Generate exam with empty title (Should fail 400)
  console.log('\n[Test Case 8] AI Generate exam with empty title:');
  const response8 = await fetch(`${BASE_URL}/api/creator/exams/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      standardId,
      title: '   ',
      timeLimit: 90,
      config: {
        SINGLE: { count: 5, score: 2 }
      }
    })
  });
  const result8 = await response8.json();
  console.log(`Status: ${response8.status}`);
  console.log(`Result:`, result8);
  if (response8.status !== 400 || result8.error !== '请配置试卷的考核标题名称') {
    console.error('FAIL: AI Generate empty title check failed.');
    process.exit(1);
  } else {
    console.log('PASS: AI Generate empty title check correctly blocked.');
  }

  // Clean up created test exam
  console.log('\nCleaning up created test exam...');
  await prisma.question.deleteMany({ where: { examId } });
  await prisma.exam.delete({ where: { id: examId } });
  console.log('Cleanup completed successfully.');

  console.log('\n--- ALL BACKEND API VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Unexpected error running API tests:', err);
  process.exit(1);
});
