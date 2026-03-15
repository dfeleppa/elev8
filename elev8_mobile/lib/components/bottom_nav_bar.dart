import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return null;
  
  try {
    final response = await Supabase.instance.client
        .from('app_users')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
    return response;
  } catch (_) {
    return null;
  }
});

class Elev8BottomNavBar extends ConsumerWidget {
  final int selectedIndex;

  const Elev8BottomNavBar({super.key, required this.selectedIndex});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);

    return NavigationBar(
      backgroundColor: const Color(0xFF0F172A),
      indicatorColor: Colors.white12,
      selectedIndex: selectedIndex,
      onDestinationSelected: (index) {
        switch (index) {
          case 0: context.go('/'); break;
          case 1: context.go('/schedule'); break;
          case 2: context.go('/athlete-dashboard'); break;
          case 3: context.go('/nutrition'); break;
          case 4: context.go('/messenger'); break;
        }
      },
      destinations: [
        const NavigationDestination(icon: Icon(Icons.home_outlined, color: Colors.white54), selectedIcon: Icon(Icons.home, color: Colors.white), label: 'Home'),
        const NavigationDestination(icon: Icon(Icons.calendar_month_outlined, color: Colors.white54), selectedIcon: Icon(Icons.calendar_month, color: Colors.white), label: 'Schedule'),
        NavigationDestination(
          icon: profileAsync.when(
            data: (data) {
              final avatarUrl = data?['avatar_url'] as String?;
              final fullName = data?['full_name'] as String? ?? 'A';
              final initial = fullName.isNotEmpty ? fullName[0].toUpperCase() : 'A';
              
              if (avatarUrl != null && avatarUrl.isNotEmpty) {
                 return CircleAvatar(radius: 14, backgroundImage: NetworkImage(avatarUrl));
              }
              return CircleAvatar(
                radius: 14, 
                backgroundColor: Colors.blueAccent, 
                child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold))
              );
            },
            loading: () => const CircleAvatar(radius: 14, backgroundColor: Colors.white10),
            error: (_, __) => const CircleAvatar(radius: 14, backgroundColor: Colors.white10, child: Icon(Icons.person, size: 16, color: Colors.white54)),
          ),
          label: 'You',
        ),
        const NavigationDestination(icon: Icon(Icons.restaurant_outlined, color: Colors.white54), selectedIcon: Icon(Icons.restaurant, color: Colors.white), label: 'Nutrition'),
        const NavigationDestination(icon: Icon(Icons.forum_outlined, color: Colors.white54), selectedIcon: Icon(Icons.forum, color: Colors.white), label: 'Messages'),
      ],
    );
  }
}
