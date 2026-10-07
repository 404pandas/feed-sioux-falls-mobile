import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import Icon from './Icon';
import { brand } from '../theme/tokens';

// The website's phone tab bar: white, ink rule on top, icon + bold label,
// and a teal bar over the current tab. Each tab's options set `tabIcon`
// (an Icon name) and `title`. A tab can set `onTabPress` to go somewhere
// else instead (the survey opens full-screen, without the tab bar).
export default function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: brand.paper,
        borderTopWidth: 2,
        borderTopColor: brand.ink,
        paddingBottom: insets.bottom,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? brand.teal : brand.ink;
        const label = options.tabBarLabel || options.title || route.name;
        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return;
          if (options.onTabPress) options.onTabPress(navigation);
          else if (!focused) navigation.navigate(route.name);
        }
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={{ flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center' }}
          >
            {focused && (
              <View
                style={{ position: 'absolute', top: 0, left: '22%', right: '22%', height: 5, backgroundColor: brand.teal, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}
              />
            )}
            <Icon name={options.tabIcon} size={26} color={color} />
            <Text style={{ fontSize: 13, fontWeight: '700', color, marginTop: 2 }} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
