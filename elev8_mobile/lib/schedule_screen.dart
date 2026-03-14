import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'components/sidebar_shell.dart';
import 'components/bottom_nav_bar.dart';

class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          title: const Text('Class Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Today', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Expanded(
                  child: ListView(
                    children: const [
                      _ClassCard(time: '5:00 AM', name: 'CrossFit', coach: 'Mike T', spots: 2, isActive: false),
                      _ClassCard(time: '6:15 AM', name: 'CrossFit', coach: 'Mike T', spots: 8, isActive: false),
                      _ClassCard(time: '9:00 AM', name: 'Powerlifting', coach: 'Sarah J', spots: 12, isActive: true),
                      _ClassCard(time: '12:00 PM', name: 'CrossFit', coach: 'Alex B', spots: 15, isActive: false),
                      _ClassCard(time: '4:30 PM', name: 'CrossFit', coach: 'Mike T', spots: 1, isActive: false),
                      _ClassCard(time: '5:45 PM', name: 'CrossFit', coach: 'Alex B', spots: 0, isActive: false),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 1),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final String time;
  final String name;
  final String coach;
  final int spots;
  final bool isActive;

  const _ClassCard({required this.time, required this.name, required this.coach, required this.spots, this.isActive = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        border: isActive ? Border.all(color: Colors.blueAccent.withOpacity(0.5), width: 2) : Border.all(color: Colors.white10),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            child: Text(time, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          Container(width: 1, height: 40, color: Colors.white10, margin: const EdgeInsets.symmetric(horizontal: 16)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('Coach $coach', style: const TextStyle(color: Colors.white54, fontSize: 14)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(spots > 0 ? '$spots spots' : 'Waitlist', style: TextStyle(color: spots > 0 ? Colors.greenAccent : Colors.orangeAccent, fontSize: 14, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: BorderSide(color: spots > 0 ? Colors.white38 : Colors.orangeAccent.withOpacity(0.5)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                child: Text(spots > 0 ? 'Reserve' : 'Join WL', style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
