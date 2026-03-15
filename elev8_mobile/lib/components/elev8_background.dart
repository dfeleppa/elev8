import 'package:flutter/material.dart';

class Elev8Background extends StatelessWidget {
  final Widget child;

  const Elev8Background({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Base Linear Gradient
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                stops: [0.0, 0.6, 1.0],
                colors: [
                  Color(0xFFFBF8F4), // #fbf8f4
                  Color(0xFFF6F2EE), // #f6f2ee
                  Color(0xFFF2EDE7), // #f2ede7
                ],
              ),
            ),
          ),
        ),
        
        // Radial Gradient 1: 12% 18% -> Alignment(-0.76, -0.64)
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.76, -0.64),
                radius: 0.55,
                colors: [
                  Color(0x2EFF8F9A), // rgba(255, 143, 154, 0.18)
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        
        // Radial Gradient 2: 86% 12% -> Alignment(0.72, -0.76)
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0.72, -0.76),
                radius: 0.45,
                colors: [
                  Color(0x33FFCF87), // rgba(255, 207, 135, 0.20)
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        
        // Radial Gradient 3: 68% 72% -> Alignment(0.36, 0.44)
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0.36, 0.44),
                radius: 0.55,
                colors: [
                  Color(0x33B7E1FF), // rgba(183, 225, 255, 0.20)
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        
        // Children on top
        Positioned.fill(
          child: child,
        ),
      ],
    );
  }
}
