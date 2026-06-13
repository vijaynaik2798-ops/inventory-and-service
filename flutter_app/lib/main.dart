import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'screens/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase configuration template natively
  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: "AIzaSyBinZIv2MyutiBqO0egFMnkBtdzVQwOb5Q",
        appId: "1:392038421695:web:ea7110eb2fd46f2ab4a20a",
        messagingSenderId: "392038421695",
        projectId: "collective-hill-t5xj8",
        storageBucket: "collective-hill-t5xj8.firebasestorage.app",
      ),
    );
  } catch (e) {
    debugPrint("Firebase already initialized or initialization bypassed for environment: ${e.toString()}");
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Inventory & Service Matrix Pro',
      debugShowCheckedModeBanner: false,
      
      // Modern Material 3 Theme setup with green & indigo accents
      themeMode: ThemeMode.system,
      
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.teal,
          brightness: Brightness.light,
        ),
        cardTheme: const CardTheme(
          elevation: 1,
          margin: EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        ),
        fontFamily: 'Inter',
      ),
      
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.teal,
          brightness: Brightness.dark,
        ),
        cardTheme: const CardTheme(
          elevation: 1,
          margin: EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        ),
        fontFamily: 'Inter',
      ),

      home: const LoginScreen(),
    );
  }
}
